import type { Page } from '@/types'

function normalizeApiBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '')
  if (!normalized) throw new Error('VITE_API_BASE_URL must be a non-empty API base path')

  if (/^https?:\/\/[^/]+$/i.test(normalized)) {
    throw new Error('VITE_API_BASE_URL must include the API path, for example https://api.example.com/api/v1')
  }

  return normalized
}

function joinApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

const CONFIGURED_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '/api')
const BASE_URL = import.meta.env.VITE_USE_MOCK === 'true' ? '/api' : CONFIGURED_BASE_URL

const ACCESS_TOKEN_KEY = 'qgents_access_token'
const REFRESH_TOKEN_KEY = 'qgents_refresh_token'

/** 登录态失效事件：refresh 也失败时派发，AuthContext 监听后清状态踢回登录页 */
export const AUTH_EXPIRED_EVENT = 'qgents:auth-expired'

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  skipAuth?: boolean
  /** 取消信号；组件卸载 / StrictMode cleanup 时 abort 可中断 in-flight 请求 */
  signal?: AbortSignal
}


export function getStoredToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/** 返回 API 基础地址（用于拼接 SSE 等完整 URL） */
export function getApiBaseUrl(): string {
  return BASE_URL
}

function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/** 刷新 access token 的单例 Promise —— 并发请求同时 401 时只发一次 refresh */
let refreshPromise: Promise<string | null> | null = null

/** 刷新 access token（供 SSE 等不走 rawRequest 的路径复用）。成功返回新 access token，失败返回 null。 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) return null
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch(joinApiUrl(BASE_URL, '/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) return null
      const json = (await res.json()) as {
        data?: { accessToken?: string; refreshToken?: string }
      }
      const data = json?.data
      if (data?.accessToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
        // refresh token 可能轮换，有则更新
        if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
        return data.accessToken
      }
      return null
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/** 发出一次请求（构造 headers + fetch + 解析） */
async function doFetch(path: string, options: RequestOptions): Promise<{ res: Response; json: unknown }> {
  const { body, skipAuth, headers, ...rest } = options
  const finalHeaders: Record<string, string> = body instanceof FormData ? {} : { 'Content-Type': 'application/json' }

  if (!skipAuth) {
    const token = getStoredToken()
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`
  }

  if (headers) Object.assign(finalHeaders, headers as Record<string, string>)

  const res = await fetch(joinApiUrl(BASE_URL, path), {
    ...rest,
    headers: finalHeaders,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 No Content
  if (res.status === 204) return { res, json: undefined }

  let raw: string
  try {
    raw = await res.text()
  } catch {
    raw = ''
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    if (res.ok) {
      throw new ApiError('Expected a JSON API response', res.status, raw)
    }
    json = raw
  }

  return { res, json }
}

/** 底层请求：返回后端统一响应的原始 JSON（含 data / page / error） */
async function rawRequest(path: string, options: RequestOptions = {}): Promise<unknown> {
  const { skipAuth } = options

  let { res, json } = await doFetch(path, options)

  // 接口契约只保证 401 表示未认证或 Token 失效，未承诺具体错误码。
  // 因此任意受认证请求遇到 401 都刷新一次并重试；skipAuth 接口不触发，避免 refresh 死循环。
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      ; ({ res, json } = await doFetch(path, options))
    } else {
      // 刷新也失败 → 清 token，派发事件让 AuthContext 踢回登录页
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }
  }

  if (!res.ok) {
    // 提取后端统一错误响应 { error: { code, message } }，把 message 透传到错误信息，避免页面只显示 "Request failed: 4xx"
    let message = `Request failed: ${res.status}`
    if (json && typeof json === 'object' && 'error' in json) {
      const err = (json as Record<string, unknown>).error as
        | { code?: string; message?: string }
        | undefined
      if (err && typeof err.message === 'string' && err.message) {
        message = err.message
      }
    }
    throw new ApiError(message, res.status, json)
  }

  return json
}

/** 普通请求：解出 `data` 层返回 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const json = await rawRequest(path, options)

  if (json && typeof json === 'object' && 'data' in json) {
    return (json as Record<string, unknown>).data as T
  }

  return json as T
}

/** 分页请求：解出 `data` + `page` 层，当前接口「列表分页」 */
export async function requestPage<T>(path: string, options: RequestOptions = {}): Promise<Page<T>> {
  const json = (await rawRequest(path, options)) as Record<string, unknown> | undefined

  if (json && typeof json === 'object') {
    const data = ('data' in json ? json.data : []) as T[]
    const page = (json.page as Page<T>['page']) ?? { nextCursor: null, hasMore: false }
    return { data, page }
  }

  return { data: [], page: { nextCursor: null, hasMore: false } }
}

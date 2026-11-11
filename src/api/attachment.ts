import { getApiBaseUrl, getStoredToken, request } from './client'

/** POST /projects/{projectId}/attachments 响应 */
export interface AttachmentCredential {
  attachmentId: string
  uploadUrl: string
  method: 'PUT'
  expiresAt: string
  headers: Record<string, string>
}

/** 附件预览类型（服务端判定） */
export type AttachmentPreviewType = 'IMAGE' | 'PDF' | 'TEXT' | 'CODE' | 'UNSUPPORTED'

/** GET .../attachments/{attachmentId} 响应 */
export interface AttachmentInfo {
  attachmentId: string
  fileName: string
  mediaType: string | null
  sizeBytes: number | null
  previewable: boolean
  previewType: AttachmentPreviewType
  // 短期内容地址（带 token），使用 resolvePreviewUrl 转换后交给 img/iframe/fetch。
  contentUrl: string
  expiresAt: string
}

/** 附件上传、确认、信息与内容访问。 */
export const attachmentApi = {
  /** 创建对象存储直传凭证 */
  createCredential(
    projectId: string,
    input: { fileName: string; contentType?: string; sizeBytes: number },
  ) {
    return request<AttachmentCredential>(`/projects/${projectId}/attachments`, {
      method: 'POST',
      body: input,
    })
  },

  /** 确认上传完成，服务端校验对象存在后置 READY */
  confirm(projectId: string, attachmentId: string) {
    return request<{ attachmentId: string; status: string }>(
      `/projects/${projectId}/attachments/${attachmentId}/confirm`,
      { method: 'POST' },
    )
  },

  /** 需要登录鉴权的内容地址：消息 content.url 与聊天缩略图使用此值 */
  contentUrl(projectId: string, attachmentId: string): string {
    return `${getApiBaseUrl()}/projects/${projectId}/attachments/${attachmentId}/content`
  },

  /** 获取附件信息和短期内容地址。 */
  info(projectId: string, attachmentId: string) {
    return request<AttachmentInfo>(`/projects/${projectId}/attachments/${attachmentId}`)
  },
}

/** 后端路径按 API 基础地址转换，兼容开发代理与独立 API 域名；OSS 地址原样返回。 */
export function resolvePreviewUrl(previewUrl: string): string {
  if (/^https?:\/\//i.test(previewUrl)) return previewUrl
  const base = getApiBaseUrl()
  const origin = /^https?:\/\//i.test(base) ? new URL(base).origin : window.location.origin
  if (previewUrl.startsWith('/api/v1/')) {
    return new URL(
      `${base}${previewUrl.slice('/api/v1'.length)}`,
      window.location.origin,
    ).toString()
  }
  return new URL(previewUrl, origin).toString()
}

/** 创建凭证、上传到配置的存储并确认，返回附件 ID。 */
export async function uploadAttachment(projectId: string, file: File): Promise<string> {
  const credential = await attachmentApi.createCredential(projectId, {
    fileName: file.name,
    contentType: file.type || undefined,
    sizeBytes: file.size,
  })

  const targetUrl = resolvePreviewUrl(credential.uploadUrl)
  const apiBase = new URL(getApiBaseUrl(), window.location.origin)
  const target = new URL(targetUrl)
  const apiPath = apiBase.pathname.replace(/\/$/, '')
  const isBackendUpload =
    target.origin === apiBase.origin && target.pathname.startsWith(`${apiPath}/projects/`)
  // 保留凭证指定的 Content-Type 等上传头。
  const headers: Record<string, string> = { ...(credential.headers ?? {}) }
  if (isBackendUpload) {
    const token = getStoredToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const putRes = await fetch(targetUrl, {
    method: credential.method,
    headers,
    body: await file.arrayBuffer(),
  })
  if (!putRes.ok) {
    throw new Error(`附件上传失败（${putRes.status}）`)
  }

  await attachmentApi.confirm(projectId, credential.attachmentId)
  return credential.attachmentId
}

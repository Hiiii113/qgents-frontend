import { AuthContext, type AuthSession, type AuthContextValue } from './AuthContext'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { message } from 'antd'
import type { User } from '@/types'
import { useQueryClient } from '@tanstack/react-query'
import { useAppUiStore } from '@/store/appUiStore'
import { authApi } from '@/api'
import {
  AUTH_EXPIRED_EVENT,
  beginLogout,
  endLogout,
  getLogoutRefreshToken,
  refreshAccessToken,
} from '@/api/client'
import { RSA_KEY_ID, encryptPassword } from '@/utils/rsaConfig'

/** localStorage key */
const ACCESS_TOKEN_KEY = 'qgents_access_token'
const REFRESH_TOKEN_KEY = 'qgents_refresh_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [hasTeam, setHasTeam] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  // ──── 启动时恢复登录态 ────
  // 每次挂载都执行 restore；用 cancelled 标志处理卸载竞态。
  // React StrictMode 开发模式下会「挂载 → 卸载 → 再挂载」，
  // 第一次 restore 因 cleanup 置 cancelled 而被丢弃，第二次挂载重新恢复。
  useEffect(() => {
    let cancelled = false
    // StrictMode 下组件会「挂载 → 卸载 → 再挂载」，cleanup 里 abort 掉首挂载发出的 /me，
    // 避免同一次刷新真实发出两个 /me（第二个还会在连接上排队 stall）。
    const controller = new AbortController()

    async function restore() {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY)
      if (!token) {
        if (!cancelled) setIsBootstrapping(false)
        return
      }

      try {
        const me = await authApi.me(controller.signal)
        if (cancelled) return
        const user = me.user
        if (!user?.id) throw new Error('GET /me 未返回用户')
        setUser(user)
        setHasTeam(me.teams.length > 0)
        queryClient.setQueryData(['teams', 'mine'], me.teams)
        useAppUiStore.getState().setCurrentTeam(me.currentTeamId)
      } catch {
        // token 过期或无效 → 清掉
        if (!cancelled) {
          localStorage.removeItem(ACCESS_TOKEN_KEY)
          localStorage.removeItem(REFRESH_TOKEN_KEY)
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false)
      }
    }

    restore()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [queryClient])

  // ──── 监听登录态失效（client.ts 在 refresh 也失败时派发）────
  // user 置 null 后，RequireAuth 守卫会自动跳回登录页
  useEffect(() => {
    function handleAuthExpired() {
      setUser(null)
      setHasTeam(false)
      useAppUiStore.getState().clearContext()
      queryClient.clear()
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
  }, [queryClient])

  // ──── 登录：只调接口 + 存 token，返回会话；state 由 completeAuth 统一写入 ────
  const login = useCallback(
    async (email: string, password: string): Promise<AuthSession> => {
      // 使用硬编码的固定 RSA 公钥加密密码（mock 阶段 encryptPassword 直传明文）
      const encryptedPassword = await encryptPassword(password)

      const result = await authApi.login({
        email,
        password: encryptedPassword,
        passwordKeyId: RSA_KEY_ID,
      })

      if (!result.accessToken || !result.refreshToken || !result.user) {
        throw new Error('登录响应缺少 token 或用户信息')
      }

      localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken)

      // 账户聚合校验最近团队并补齐其可用团队，页面无需再让用户选择。
      const me = await authApi.me()
      queryClient.setQueryData(['teams', 'mine'], me.teams)
      return { user: me.user, hasTeam: me.teams.length > 0, currentTeamId: me.currentTeamId }
    },
    [queryClient],
  )

  // ──── 注册：只调接口 + 存 token，返回会话（新用户没有团队）────
  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      verificationCode: string,
    ): Promise<AuthSession> => {
      // 使用硬编码的固定 RSA 公钥加密密码（mock 阶段 encryptPassword 直传明文）
      const encryptedPassword = await encryptPassword(password)

      const result = await authApi.register({
        email,
        password: encryptedPassword,
        passwordKeyId: RSA_KEY_ID,
        displayName,
        verificationCode,
      })

      localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken)
      return { user: result.user, hasTeam: false }
    },
    [],
  )

  // ──── 退出 ────
  const logout = useCallback(async () => {
    beginLogout()
    try {
      // 等待本页面已在途的刷新，用轮换后的最新 refresh token 去撤销
      await refreshAccessToken()
      const refreshToken = getLogoutRefreshToken()
      setUser(null)
      setHasTeam(false)
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      useAppUiStore.getState().clearContext()
      queryClient.clear()
      try {
        if (refreshToken) await authApi.logout(refreshToken)
      } catch {
        // 网络失败仍已完成本地退出，但服务端撤销未确认
        void message.warning('已退出登录，但服务端未能确认撤销')
      }
    } finally {
      endLogout()
    }
  }, [queryClient])

  // ──── 把登录/注册结果一次性写入 state，供 LoginPage 在 navigate 的同一同步块内调用 ────
  const completeAuth = useCallback((session: AuthSession) => {
    setUser(session.user)
    setHasTeam(session.hasTeam)
    useAppUiStore.getState().setCurrentTeam(session.currentTeamId ?? null)
  }, [])

  // ──── 更新当前用户资料（PATCH /me 成功后同步本地 user）────
  const updateUser = useCallback((next: User) => {
    setUser(next)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      hasTeam,
      isBootstrapping,
      login,
      register,
      completeAuth,
      logout,
      setHasTeam,
      updateUser,
    }),
    [user, hasTeam, isBootstrapping, login, register, completeAuth, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

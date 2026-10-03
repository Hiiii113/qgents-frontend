import { createContext, useContext } from 'react'
import type { User } from '@/types'

export interface AuthContextValue {
  /** 当前用户，null = 未登录 */
  user: User | null
  /** 是否已登录 */
  isAuthenticated: boolean
  /** 是否已加入至少一个团队 */
  hasTeam: boolean
  /** 是否正在初始化（bootstrap 阶段） */
  isBootstrapping: boolean

  /** 登录：只调接口 + 存 token，返回会话，不更新 state */
  login: (email: string, password: string) => Promise<AuthSession>
  /** 注册：只调接口 + 存 token，返回会话，不更新 state；verificationCode 为邮箱验证码 */
  register: (email: string, password: string, displayName: string, verificationCode: string) => Promise<AuthSession>
  /** 把登录/注册结果一次性写入 state（与 navigate 同批调用，避免 RedirectIfAuthed 抢跳） */
  completeAuth: (session: AuthSession) => void
  /** 退出登录 */
  logout: () => Promise<void>
  /** 设置 hasTeam（创建/加入团队后调用） */
  setHasTeam: (v: boolean) => void
  /** 更新当前用户资料（PATCH /me 成功后同步本地 user，如昵称/头像） */
  updateUser: (user: User) => void
}

/** 登录/注册成功后的会话结果 */
export interface AuthSession {
  user: User
  hasTeam: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { App, Button } from 'antd'
import { useAuth } from '@/context/AuthContext'
import { authApi } from '@/api'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import './LoginPage.css'

type AuthTab = 'login' | 'register'

/** 品牌区只放纯排版：编号 + 中文短句，不用插画和图标。 */
const FEATURES = [
  { title: '从项目聊天开始', description: '成员共同讨论，@Qgent 协助分析与执行' },
  { title: '按需使用 Qgent', description: '在群聊中 @Qgent 发起协作，保留上下文与成果' },
  { title: '知识与代码在同一处', description: '共享项目知识，可选接入 GitHub 处理代码' },
]

/**
 * 登录 / 注册页：左侧品牌栏（纯排版），右侧窄栏表单。
 * 两栏之间只用一条发丝线分隔，不做卡片与装饰。
 */
export function LoginPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { login, register, completeAuth } = useAuth()
  const [tab, setTab] = useState<AuthTab>('login')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [codeSending, setCodeSending] = useState(false)
  const [codeCountdown, setCodeCountdown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const codeTimerRef = useRef<number | null>(null)

  // 卸载时清理验证码倒计时定时器
  useEffect(() => {
    return () => {
      if (codeTimerRef.current !== null) window.clearInterval(codeTimerRef.current)
    }
  }, [])

  /** 注册 tab：向邮箱发送验证码（60s 后可重发）。 发送前先做邮箱格式校验 */
  async function sendVerificationCode() {
    const trimmedEmail = email.trim()
    if (codeSending || codeCountdown > 0 || !trimmedEmail) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('请输入正确的邮箱地址')
      return
    }
    setError(null)
    setCodeSending(true)
    try {
      const result = await authApi.sendRegisterCode(trimmedEmail)
      //  响应 202：data.message 为「验证码已发送到邮箱，10 分钟内有效」
      message.success(result?.message || '验证码已发送到邮箱，10 分钟内有效')
      setCodeCountdown(60)
      if (codeTimerRef.current !== null) window.clearInterval(codeTimerRef.current)
      codeTimerRef.current = window.setInterval(() => {
        setCodeCountdown((prev) => {
          if (prev <= 1) {
            if (codeTimerRef.current !== null) window.clearInterval(codeTimerRef.current)
            codeTimerRef.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setCodeSending(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    //  注册必须携带 6 位数字邮箱验证码（「过了才能通过」）
    if (tab === 'register' && !/^\d{6}$/.test(verificationCode.trim())) {
      setError('请输入 6 位数字邮箱验证码')
      return
    }

    setSubmitting(true)

    try {
      const session =
        tab === 'login'
          ? await login(email, password)
          : await register(email, password, displayName || email.split('@')[0], verificationCode)
      // completeAuth 与 navigate 在同一同步块内，React 批处理成一次渲染，
      // 避免 setUser 先触发 RedirectIfAuthed 用残留的 location.state.from 抢跳
      completeAuth(session)
      navigate(
        session.currentTeamId
          ? PATHS.teamDetail(session.currentTeamId)
          : session.hasTeam
            ? PATHS.APP
            : PATHS.WELCOME,
        { replace: true, state: null },
      )
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  function switchTab(t: AuthTab) {
    setTab(t)
    setError(null)
  }

  return (
    <div className="login-page">
      <aside className="login-page__brand" aria-label="品牌介绍">
        <p className="login-page__wordmark">
          <span className="login-page__mark">Q</span>gents
        </p>
        <h1 className="login-page__headline">团队与 Qgent，在同一个项目现场协作</h1>

        <ul className="login-page__features">
          {FEATURES.map((feature, index) => (
            <li key={feature.title}>
              <span className="login-page__feature-index qg-num">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="login-page__feature-text">
                <strong>{feature.title}</strong>
                <p>{feature.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <section className="login-page__panel">
        <div className="login-form">
          <header className="login-form__header">
            <h2 className="login-form__title">{tab === 'login' ? '登录 Qgents' : '注册 Qgents'}</h2>
            <p className="login-form__desc">
              {tab === 'login' ? '使用个人账号进入你的团队' : '创建账号，开始团队协作'}
            </p>
          </header>

          <div className="login-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={tab === 'login' ? 'login-tabs__tab is-active' : 'login-tabs__tab'}
              onClick={() => switchTab('login')}
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'register'}
              className={tab === 'register' ? 'login-tabs__tab is-active' : 'login-tabs__tab'}
              onClick={() => switchTab('register')}
            >
              注册
            </button>
          </div>

          <form className="login-form__body" onSubmit={handleSubmit}>
            {error && (
              <p className="login-form__error" role="alert">
                {error}
              </p>
            )}

            <div className="login-field">
              <label className="login-field__label" htmlFor="login-email">
                邮箱地址
              </label>
              <input
                id="login-email"
                className="login-field__input"
                type="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {/* 昵称 —— 仅注册时显示 */}
            {tab === 'register' && (
              <div className="login-field">
                <label className="login-field__label" htmlFor="login-display-name">
                  昵称
                </label>
                <input
                  id="login-display-name"
                  className="login-field__input"
                  type="text"
                  placeholder="你的昵称"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            {/* 邮箱验证码 —— 仅注册时显示：先获取验证码，填写后随注册提交 */}
            {tab === 'register' && (
              <div className="login-field">
                <label className="login-field__label" htmlFor="login-code">
                  邮箱验证码
                </label>
                <div className="login-field__row">
                  <input
                    id="login-code"
                    className="login-field__input"
                    type="text"
                    inputMode="numeric"
                    placeholder="邮箱验证码"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    autoComplete="one-time-code"
                    required
                  />
                  <button
                    type="button"
                    className="login-field__code"
                    onClick={() => void sendVerificationCode()}
                    disabled={codeSending || codeCountdown > 0 || !email.trim()}
                  >
                    {codeCountdown > 0
                      ? `${codeCountdown}s`
                      : codeSending
                        ? '发送中…'
                        : '获取验证码'}
                  </button>
                </div>
              </div>
            )}

            <div className="login-field">
              <label className="login-field__label" htmlFor="login-password">
                密码
              </label>
              <div className="login-field__row">
                <input
                  id="login-password"
                  className="login-field__input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  className="login-field__icon-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  <EyeIcon />
                </button>
              </div>
            </div>

            {tab === 'login' && (
              <div className="login-form__meta">
                {/* 忘记密码：跳独立找回页（输入邮箱获取验证码 → 设置新密码） */}
                <Link to={PATHS.FORGOT_PASSWORD} className="login-link">
                  忘记密码
                </Link>
              </div>
            )}

            <Button
              type="primary"
              htmlType="submit"
              block
              autoInsertSpace={false}
              disabled={submitting}
            >
              {submitting ? '请稍候…' : tab === 'login' ? '登录' : '注册'}
            </Button>
          </form>

          <p className="login-form__switch">
            {tab === 'login' ? '还没有账号？' : '已有账号？'}
            <button
              type="button"
              className="login-link"
              onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
            >
              {tab === 'login' ? '立即注册' : '去登录'}
            </button>
          </p>

          <p className="login-form__footnote">登录后可选择或创建团队</p>
        </div>
      </section>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

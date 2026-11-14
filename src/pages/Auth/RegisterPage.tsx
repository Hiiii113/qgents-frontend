import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { App, Form } from 'antd'
import { useAuth } from '@/context/AuthContext'
import { authApi } from '@/api/auth'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { Button, Icon, TextField } from '@/components/ui'
import { Gate, GateAside, GateForm } from './Gate'
import { CodeField, PasswordField } from './authFields'
import { useCountdown } from './useCountdown'

interface Values {
  displayName: string
  email: string
  verificationCode: string
  password: string
}

/** 注册：邮箱验证码一次性有效，注册成功后进入无团队的欢迎页。 */
export function RegisterPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { register, completeAuth } = useAuth()
  const [form] = Form.useForm<Values>()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sending, setSending] = useState(false)
  const { left, start } = useCountdown()

  async function sendCode() {
    const email = String(form.getFieldValue('email') ?? '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请先填写正确的邮箱地址')
      return
    }
    setError(null)
    setSending(true)
    try {
      const result = await authApi.sendRegisterCode(email)
      void message.success(result?.message || '验证码已发送到邮箱，10 分钟内有效')
      start()
    } catch (failure) {
      setError(formatApiError(failure))
    } finally {
      setSending(false)
    }
  }

  async function handleFinish(values: Values) {
    setError(null)
    setSubmitting(true)
    try {
      const session = await register(
        values.email.trim(),
        values.password,
        values.displayName.trim(),
        values.verificationCode.trim(),
      )
      completeAuth(session)
      navigate(PATHS.WELCOME, { replace: true })
    } catch (failure) {
      setError(formatApiError(failure))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Gate>
      <GateAside />
      <GateForm>
        <h1 className="gate__title">创建账号</h1>
        <p className="sub">注册后可以创建团队，或凭邀请加入团队。</p>
        <Form
          form={form}
          layout="vertical"
          className="form"
          onFinish={(values: Values) => void handleFinish(values)}
          disabled={submitting}
          requiredMark={false}
        >
          {error ? (
            <p className="err" role="alert">
              {error}
            </p>
          ) : null}
          <Form.Item
            name="displayName"
            label="昵称"
            rules={[{ required: true, whitespace: true, message: '请输入昵称' }]}
          >
            <TextField autoComplete="nickname" autoFocus />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入正确的邮箱地址' },
            ]}
          >
            <TextField type="email" autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="verificationCode"
            label="验证码"
            rules={[
              { required: true, message: '请输入邮箱验证码' },
              { pattern: /^\d{6}$/, message: '验证码为 6 位数字' },
            ]}
          >
            <CodeField onSend={() => void sendCode()} sending={sending} countdown={left} />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '至少 8 位' },
            ]}
          >
            <PasswordField autoComplete="new-password" placeholder="至少 8 位" />
          </Form.Item>
          <div className="form__foot">
            <Button
              variant="primary"
              type="submit"
              icon={<Icon name="arrow-right" size={15} />}
              disabled={submitting}
            >
              {submitting ? '正在提交…' : '注册并继续'}
            </Button>
          </div>
        </Form>
        <p className="gate__alt">
          已有账号？<Link to={PATHS.LOGIN}>登录</Link>
        </p>
      </GateForm>
    </Gate>
  )
}

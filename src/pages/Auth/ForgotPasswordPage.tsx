import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form } from 'antd'
import { authApi } from '@/api/auth'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'
import { RSA_KEY_ID, encryptPassword } from '@/utils/rsaConfig'
import { formatApiError } from '@/utils/formatApiError'
import { Button, TextField, Icon } from '@/components/ui'
import { Gate, GateAside, GateForm } from './Gate'
import { CodeField, PasswordField } from './authFields'
import { useCountdown } from './useCountdown'

type Stage = 'request' | 'reset' | 'done'

interface RequestValues {
  email: string
}

interface ResetValues {
  code: string
  password: string
  confirm: string
}

/** 找回密码：先发验证码，再用验证码设置新密码。新密码走 RSA 加密。 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { isAuthenticated, logout } = useAuth()
  const [stage, setStage] = useState<Stage>('request')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sending, setSending] = useState(false)
  const { left, start } = useCountdown()
  const [requestForm] = Form.useForm<RequestValues>()
  const [resetForm] = Form.useForm<ResetValues>()

  async function requestCode() {
    const value = String(requestForm.getFieldValue('email') ?? email).trim()
    if (!value) {
      setError('请输入注册邮箱')
      return
    }
    setError(null)
    setSending(true)
    try {
      await authApi.resetPasswordRequest(value)
      setEmail(value)
      setStage('reset')
      start()
    } catch (failure) {
      setError(formatApiError(failure))
    } finally {
      setSending(false)
    }
  }

  async function reset(values: ResetValues) {
    setError(null)
    if (values.password !== values.confirm) {
      setError('两次输入的新密码不一致')
      return
    }
    setSubmitting(true)
    try {
      await authApi.resetPassword({
        email,
        token: values.code.trim(),
        newPassword: await encryptPassword(values.password),
        passwordKeyId: RSA_KEY_ID,
      })
      // 重置后服务端已撤销全部会话：本机也主动退出，回登录页用新密码重登。
      if (isAuthenticated) await logout()
      setStage('done')
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
        <h1 className="gate__title">
          {stage === 'request' ? '找回密码' : stage === 'reset' ? '设置新密码' : '密码已重置'}
        </h1>
        <p className="sub">
          {stage === 'request'
            ? '填写账号邮箱，我们会发一封验证码邮件。'
            : stage === 'reset'
              ? `验证码已发送至 ${email}`
              : '新密码已生效，现在可以用新密码登录了。'}
        </p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}

        {stage === 'request' ? (
          <Form
            form={requestForm}
            layout="vertical"
            className="form"
            onFinish={() => void requestCode()}
            disabled={sending}
            requiredMark={false}
          >
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入注册邮箱' },
                { type: 'email', message: '请输入正确的邮箱地址' },
              ]}
            >
              <TextField type="email" autoComplete="email" autoFocus />
            </Form.Item>
            <div className="form__foot form__foot--start">
              <Button
                variant="primary"
                type="submit"
                icon={<Icon name="send" size={15} />}
                disabled={sending}
              >
                {sending ? '发送中…' : '发送验证码'}
              </Button>
            </div>
          </Form>
        ) : null}

        {stage === 'reset' ? (
          <Form
            form={resetForm}
            layout="vertical"
            className="form"
            onFinish={(values: ResetValues) => void reset(values)}
            disabled={submitting}
            requiredMark={false}
          >
            <Form.Item
              name="code"
              label="邮箱验证码"
              rules={[
                { required: true, message: '请输入邮箱验证码' },
                { pattern: /^\d{6}$/, message: '验证码为 6 位数字' },
              ]}
            >
              <CodeField onSend={() => void requestCode()} sending={sending} countdown={left} />
            </Form.Item>
            <Form.Item
              name="password"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 8, message: '至少 8 位' },
              ]}
            >
              <PasswordField autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirm"
              label="确认新密码"
              rules={[
                { required: true, message: '请再次输入新密码' },
                ({ getFieldValue }) => ({
                  validator: (_rule, value: string) =>
                    !value || value === getFieldValue('password')
                      ? Promise.resolve()
                      : Promise.reject(new Error('两次输入的新密码不一致')),
                }),
              ]}
            >
              <PasswordField autoComplete="new-password" />
            </Form.Item>
            <div className="form__foot form__foot--start">
              <Button
                variant="primary"
                type="submit"
                icon={<Icon name="check" size={15} />}
                disabled={submitting}
              >
                {submitting ? '提交中…' : '重置密码'}
              </Button>
            </div>
          </Form>
        ) : null}

        {stage === 'done' ? (
          <div className="form__foot form__foot--start">
            <Button
              variant="primary"
              onClick={() => navigate(PATHS.LOGIN, { replace: true })}
              icon={<Icon name="arrow-left" size={15} />}
            >
              返回登录
            </Button>
          </div>
        ) : null}

        <p className="gate__alt">
          <Link to={PATHS.LOGIN}>返回登录</Link>
        </p>
      </GateForm>
    </Gate>
  )
}

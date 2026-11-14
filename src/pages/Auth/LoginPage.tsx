import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form } from 'antd'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { Button, TextField } from '@/components/ui'
import { Gate, GateAside, GateForm } from './Gate'
import { PasswordField } from './authFields'

interface Values {
  email: string
  password: string
}

/** 登录：左侧品牌说明，右侧窄栏表单，未登录用户唯一的入口。 */
export function LoginPage() {
  const navigate = useNavigate()
  const { login, completeAuth } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleFinish(values: Values) {
    setError(null)
    setSubmitting(true)
    try {
      const session = await login(values.email.trim(), values.password)
      completeAuth(session)
      navigate(
        session.currentTeamId
          ? PATHS.teamDetail(session.currentTeamId)
          : session.hasTeam
            ? PATHS.APP
            : PATHS.WELCOME,
        { replace: true, state: null },
      )
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
        <h1 className="gate__title">登录</h1>
        <Form
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
            name="email"
            label="账号"
            rules={[
              { required: true, message: '请输入账号邮箱' },
              { type: 'email', message: '请输入正确的邮箱地址' },
            ]}
          >
            <TextField autoComplete="username" placeholder="name@company.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少 6 位' }]}
          >
            <PasswordField autoComplete="current-password" placeholder="至少 6 位" />
          </Form.Item>
          <div className="form__foot">
            <Link to={PATHS.FORGOT_PASSWORD}>忘记密码</Link>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? '正在进入…' : '进入工作台'}
            </Button>
          </div>
        </Form>
        <p className="gate__alt">
          还没有账号？<Link to={PATHS.REGISTER}>注册</Link>
        </p>
      </GateForm>
    </Gate>
  )
}

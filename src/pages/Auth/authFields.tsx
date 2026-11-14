import { useState } from 'react'
import { Button, Icon, TextField } from '@/components/ui'

/** 验证码输入 + 发送按钮，作为 Form.Item 的受控子组件。 */
export function CodeField({
  value,
  onChange,
  onSend,
  sending,
  countdown,
  disabled,
}: {
  value?: string
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSend: () => void
  sending: boolean
  countdown: number
  disabled?: boolean
}) {
  return (
    <div className="row row--tight">
      <TextField
        value={value ?? ''}
        onChange={onChange}
        inputMode="numeric"
        maxLength={6}
        placeholder="6 位数字"
        autoComplete="one-time-code"
        disabled={disabled}
      />
      <Button
        variant="quiet"
        onClick={onSend}
        disabled={sending || countdown > 0 || disabled}
        className="gate__code-btn"
      >
        {countdown > 0 ? `${countdown}s` : sending ? '发送中…' : '获取验证码'}
      </Button>
    </div>
  )
}

/** 密码输入 + 显示/隐藏，作为 Form.Item 的受控子组件。 */
export function PasswordField({
  value,
  onChange,
  autoComplete,
  placeholder,
  disabled,
}: {
  value?: string
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  autoComplete?: string
  placeholder?: string
  disabled?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="gate__password">
      <TextField
        type={visible ? 'text' : 'password'}
        value={value ?? ''}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        type="button"
        className="gate__eye"
        aria-label={visible ? '隐藏密码' : '显示密码'}
        onClick={() => setVisible((current) => !current)}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={16} />
      </button>
    </div>
  )
}

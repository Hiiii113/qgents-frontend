import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { teamApi } from '@/api/team'
import { useAuth } from '@/context/AuthContext'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import { Button, Icon, TextAreaField, TextField } from '@/components/ui'
import { Gate, GateAside, GateForm } from '../Auth/Gate'

interface Values {
  name: string
  description?: string
}

/** 创建团队：创建者成为团队所有者，之后在团队设置里邀请成员。 */
export default function CreateTeamPage() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const { hasTeam, setHasTeam } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleFinish(values: Values) {
    setError(null)
    setSubmitting(true)
    try {
      const team = await teamApi.create({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
      })
      void client.invalidateQueries({ queryKey: ['teams', 'mine'] })
      setHasTeam(true)
      navigate(PATHS.teamDetail(team.id), { replace: true })
    } catch (failure) {
      setError(formatApiError(failure))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Gate>
      <GateAside
        kicker="新建团队"
        title="团队是这一层的容器"
        description="项目、成员和 GitHub App 授权都挂在团队下。创建后你会成为团队管理员。"
        rows={false}
      />
      <GateForm>
        <h1 className="gate__title">创建团队</h1>
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
            name="name"
            label="团队名称"
            extra="会显示在顶栏与团队首页标题。"
            rules={[
              { required: true, whitespace: true, message: '请输入团队名称' },
              { max: 255, message: '团队名称最多 255 个字符' },
            ]}
          >
            <TextField placeholder="例如：砺行科技" autoFocus />
          </Form.Item>
          <Form.Item name="description" label="团队简介">
            <TextAreaField rows={3} placeholder="团队用途、协作方向（可选）" />
          </Form.Item>
          <div className="form__foot">
            <Button
              variant="quiet"
              onClick={() => navigate(hasTeam ? PATHS.SETTINGS : PATHS.WELCOME)}
              icon={<Icon name="close" size={15} />}
            >
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={<Icon name="plus" size={16} />}
              disabled={submitting}
            >
              {submitting ? '创建中…' : '创建并进入'}
            </Button>
          </div>
        </Form>
      </GateForm>
    </Gate>
  )
}

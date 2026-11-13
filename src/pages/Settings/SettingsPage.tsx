import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { App, Avatar, Button, Form, Input, Upload } from 'antd'
import {
  ArrowLeftOutlined,
  CameraOutlined,
  LockOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { authApi, teamApi, uploadAvatar } from '@/api'
import { useAuth } from '@/context/AuthContext'
import { useAppUiStore, useCurrentTeamId } from '@/store/appUiStore'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import './SettingsPage.css'

const SECTIONS = [
  { key: 'account', label: '账户', icon: <UserOutlined aria-hidden /> },
  { key: 'teams', label: '团队', icon: <TeamOutlined aria-hidden /> },
  { key: 'security', label: '安全', icon: <LockOutlined aria-hidden /> },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

/** 产品设置：左侧分区、右侧内容，?tab= 记住位置。团队切换、创建与加入在这里完成。 */
export default function SettingsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab')
  const active: SectionKey = SECTIONS.some((item) => item.key === tab)
    ? (tab as SectionKey)
    : 'account'
  // 回程只认站内项目地址，避免把外部链接当成返回目标。
  const returnTo = params.get('returnTo')
  const backTo = returnTo?.startsWith('/app/projects/') ? returnTo : null

  return (
    <div className="account-settings-page">
      <nav className="account-settings-nav" aria-label="设置分区">
        {backTo && (
          <button
            type="button"
            className="account-settings-nav__back"
            onClick={() => navigate(backTo)}
          >
            <ArrowLeftOutlined aria-hidden />
            <span>返回项目</span>
          </button>
        )}
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`account-settings-nav__item${active === item.key ? ' is-active' : ''}`}
            aria-current={active === item.key ? 'page' : undefined}
            onClick={() => {
              const next = new URLSearchParams(params)
              if (item.key === 'account') next.delete('tab')
              else next.set('tab', item.key)
              setParams(next, { replace: true })
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="account-settings-body">
        {active === 'account' && <AccountSection />}
        {active === 'teams' && <TeamsSection />}
        {active === 'security' && <SecuritySection />}
      </div>
    </div>
  )
}

function SectionHead({ title, description }: { title: string; description: string }) {
  return (
    <header className="account-settings-head">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
}

/** 账户：头像与昵称，昵称改动写回登录态，顶部头像菜单同步。 */
function AccountSection() {
  const { message } = App.useApp()
  const { user, updateUser } = useAuth()
  const [form] = Form.useForm<{ displayName: string }>()
  const [uploading, setUploading] = useState(false)

  // 昵称在头像菜单等处改动后保持表单一致
  useEffect(() => {
    form.setFieldsValue({ displayName: user?.displayName ?? '' })
  }, [form, user?.displayName])
  const saveName = useMutation({
    mutationFn: (nextName: string) => authApi.updateMe({ displayName: nextName }),
    onSuccess: (updated) => {
      updateUser(updated)
      message.success('昵称已保存')
    },
    onError: (error) => message.error(formatApiError(error)),
  })

  async function handleAvatar(file: File): Promise<boolean> {
    if (!file.type.startsWith('image/')) {
      message.warning('仅支持图片文件')
      return false
    }
    if (file.size > 5 * 1024 * 1024) {
      message.warning('图片不超过 5MB')
      return false
    }
    setUploading(true)
    try {
      const avatarUrl = await uploadAvatar(file)
      if (user) updateUser({ ...user, avatarUrl })
      message.success('头像已更新')
    } catch (error) {
      message.error(formatApiError(error))
    } finally {
      setUploading(false)
    }
    return false
  }

  return (
    <section className="account-settings-section">
      <SectionHead title="账户" description="昵称与头像会显示在团队成员和消息里。" />
      <Form
        form={form}
        layout="vertical"
        className="account-settings-form"
        initialValues={{ displayName: user?.displayName ?? '' }}
        onFinish={(values) => saveName.mutate(values.displayName.trim())}
      >
        <Form.Item label="头像" extra="JPG 或 PNG，不超过 5MB">
          <div className="account-settings-avatar">
            <Avatar size={56} src={user?.avatarUrl}>
              {user?.displayName.slice(0, 1)}
            </Avatar>
            <Upload
              accept="image/*"
              showUploadList={false}
              disabled={uploading}
              beforeUpload={handleAvatar}
            >
              <Button icon={<CameraOutlined />} loading={uploading}>
                更换头像
              </Button>
            </Upload>
          </div>
        </Form.Item>
        <Form.Item label="昵称">
          <div className="account-settings-inline">
            <Form.Item
              name="displayName"
              noStyle
              rules={[{ required: true, whitespace: true, message: '请输入昵称' }]}
            >
              <Input aria-label="昵称" maxLength={120} disabled={saveName.isPending} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saveName.isPending}>
              保存昵称
            </Button>
          </div>
        </Form.Item>
        <Form.Item label="邮箱">
          <span className="account-settings-value">{user?.email}</span>
        </Form.Item>
      </Form>
    </section>
  )
}

/** 团队：当前团队、切换、创建、加入。切换成功才改当前团队并进入该团队。 */
function TeamsSection() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const currentTeamId = useCurrentTeamId()
  const teams = useQuery({ queryKey: ['teams', 'mine'], queryFn: teamApi.listMine })
  const selectTeam = useMutation({
    mutationFn: (teamId: string) => authApi.selectTeam(teamId),
    onSuccess: (_data, teamId) => {
      useAppUiStore.getState().setCurrentTeam(teamId)
      navigate(PATHS.teamDetail(teamId))
    },
    onError: (error) => message.error(formatApiError(error)),
  })

  return (
    <section className="account-settings-section">
      <SectionHead title="团队" description="切换后进入该团队的项目。" />
      {teams.isPending ? (
        <p className="account-settings-hint">正在加载团队…</p>
      ) : teams.isError ? (
        <div className="account-settings-error">
          <p>团队列表加载失败：{formatApiError(teams.error)}</p>
          <Button onClick={() => void teams.refetch()} loading={teams.isFetching}>
            重新加载
          </Button>
        </div>
      ) : teams.data.length === 0 ? (
        <p className="account-settings-hint">还没有加入任何团队。</p>
      ) : (
        <ul className="account-settings-list">
          {teams.data.map((team) => {
            const current = team.id === currentTeamId
            return (
              <li key={team.id} className="account-settings-team">
                <Avatar size={32} shape="square" src={team.avatarUrl}>
                  {team.name.slice(0, 1)}
                </Avatar>
                <div className="account-settings-team__meta">
                  <span className="account-settings-team__name" title={team.name}>
                    {team.name}
                  </span>
                  <span className="account-settings-team__state">
                    {current ? '当前团队' : '可切换'}
                  </span>
                </div>
                {current ? (
                  <Button onClick={() => navigate(PATHS.teamSettings(team.id))}>团队管理</Button>
                ) : (
                  <Button
                    autoInsertSpace={false}
                    aria-label={`切换到${team.name}`}
                    loading={selectTeam.isPending && selectTeam.variables === team.id}
                    disabled={selectTeam.isPending}
                    onClick={() => selectTeam.mutate(team.id)}
                  >
                    切换
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="account-settings-actions">
        <Button onClick={() => navigate(PATHS.CREATE_TEAM)}>创建团队</Button>
        <Button onClick={() => navigate(PATHS.JOIN_TEAM)}>加入团队</Button>
      </div>
    </section>
  )
}

/** 安全：找回密码要先退出登录（已登录不能进找回页），退出结束当前登录态。 */
function SecuritySection() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  function signOutTo(path: string) {
    void logout().then(() => navigate(path, { replace: true }))
  }

  return (
    <section className="account-settings-section">
      <SectionHead title="安全" description="密码通过邮箱验证重置。" />
      <div className="account-settings-row">
        <span className="account-settings-row__label">登录密码</span>
        <div className="account-settings-row__control">
          <Button onClick={() => signOutTo(PATHS.FORGOT_PASSWORD)}>退出并重置密码</Button>
        </div>
      </div>
      <div className="account-settings-row">
        <span className="account-settings-row__label">当前账号</span>
        <div className="account-settings-row__control">
          <Button danger onClick={() => signOutTo(PATHS.LOGIN)}>
            退出登录
          </Button>
        </div>
      </div>
    </section>
  )
}

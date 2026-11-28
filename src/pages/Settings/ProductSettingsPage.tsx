import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { App } from 'antd'
import { useMutation, useQuery } from '@tanstack/react-query'
import { authApi, teamApi, uploadAvatar } from '@/api'
import { useAuth } from '@/context/AuthContext'
import { useAppUiStore, useCurrentTeamId } from '@/store/appUiStore'
import { PATHS } from '@/routes/paths'
import { formatApiError } from '@/utils/formatApiError'
import {
  Avatar,
  Button,
  EmptyState,
  Icon,
  Page,
  PageHead,
  Section,
  Skeleton,
  Tag,
  Tabs,
  TextField,
} from '@/components/ui'
import './product-settings.css'

const TABS = [
  { key: 'account', label: '账户' },
  { key: 'teams', label: '团队' },
  { key: 'security', label: '安全' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** 产品设置：账户资料、团队切换与安全操作。页签放进 ?tab=。 */
export default function ProductSettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab: TabKey = TABS.find((item) => item.key === params.get('tab'))?.key ?? 'account'

  return (
    <main className="canvas">
      <Page className="product-settings">
        <PageHead title="账户与团队" />
        <Tabs
          label="产品设置分区"
          items={TABS.map((item) => ({ key: item.key, label: item.label }))}
          value={tab}
          onChange={(key) => {
            const next = new URLSearchParams(params)
            if (key === 'account') next.delete('tab')
            else next.set('tab', key)
            setParams(next, { replace: true })
          }}
        />
        {tab === 'account' ? <Account /> : null}
        {tab === 'teams' ? <Teams /> : null}
        {tab === 'security' ? <Security /> : null}
      </Page>
    </main>
  )
}

function Account() {
  const { message } = App.useApp()
  const { user, updateUser } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: (displayName: string) => authApi.updateMe({ displayName }),
    onSuccess: (updated) => {
      updateUser(updated)
      setEditingName(false)
      setNameError(null)
      void message.success('昵称已保存')
    },
    onError: (error) => setNameError(formatApiError(error)),
  })

  async function handleAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploading) return
    if (!file.type.startsWith('image/')) {
      void message.warning('仅支持图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      void message.warning('图片不超过 5MB')
      return
    }
    setUploading(true)
    try {
      const avatarUrl = await uploadAvatar(file)
      if (user) updateUser({ ...user, avatarUrl })
      void message.success('头像已更新')
    } catch (error) {
      void message.error(formatApiError(error))
    } finally {
      setUploading(false)
    }
  }

  function startEditName() {
    setDraftName(user?.displayName ?? '')
    setNameError(null)
    setEditingName(true)
  }

  function cancelEditName() {
    setEditingName(false)
    setNameError(null)
  }

  function submitName() {
    const trimmed = draftName.trim()
    if (!trimmed) {
      setNameError('请输入昵称')
      return
    }
    if (trimmed.length > 120) {
      setNameError('昵称最多 120 个字符')
      return
    }
    if (trimmed === (user?.displayName ?? '').trim()) {
      setEditingName(false)
      return
    }
    save.mutate(trimmed)
  }

  const nameDirty = draftName.trim() !== (user?.displayName ?? '').trim()

  return (
    <Section title="账户资料">
      <div className="setting-group">
        <div className="setting-row">
          <div className="setting-row__info">
            <span className="setting-row__label">头像</span>
          </div>
          <div className="setting-row__control">
            <div className="account-avatar">
              <Avatar name={user?.displayName ?? '我'} src={user?.avatarUrl} size="lg" />
              <Button
                variant="quiet"
                size="sm"
                icon={<Icon name="camera" size={14} />}
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? '上传中…' : '更换头像'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => void handleAvatar(event)}
              />
            </div>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-row__info">
            <span className="setting-row__label">昵称</span>
          </div>
          <div className="setting-row__control">
            {editingName ? (
              <div className="setting-inline__edit">
                <div className="setting-inline__edit-row">
                  <TextField
                    value={draftName}
                    maxLength={120}
                    aria-label="昵称"
                    autoFocus
                    disabled={save.isPending}
                    onChange={(event) => {
                      setDraftName(event.target.value)
                      if (nameError) setNameError(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        submitName()
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelEditName()
                      }
                    }}
                  />
                  <div className="setting-inline__actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={save.isPending}
                      onClick={cancelEditName}
                    >
                      取消
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!nameDirty || save.isPending}
                      onClick={submitName}
                    >
                      {save.isPending ? '保存中…' : '保存'}
                    </Button>
                  </div>
                </div>
                {nameError ? <p className="err">{nameError}</p> : null}
              </div>
            ) : (
              <div className="setting-inline">
                <span className="setting-inline__text">{user?.displayName || '未设置'}</span>
                <Button variant="ghost" size="sm" onClick={startEditName}>
                  编辑
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-row__info">
            <span className="setting-row__label">邮箱</span>
          </div>
          <div className="setting-row__control">
            <span className="setting-row__value mono">{user?.email || ''}</span>
          </div>
        </div>
      </div>
    </Section>
  )
}

function Teams() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const currentTeamId = useCurrentTeamId()
  const teams = useQuery({ queryKey: ['teams', 'mine'], queryFn: teamApi.listMine })
  const select = useMutation({
    // 服务端确认后再改当前团队并进入；失败留在本页。
    mutationFn: (teamId: string) => authApi.selectTeam(teamId),
    onSuccess: (_data, teamId) => {
      useAppUiStore.getState().setCurrentTeam(teamId)
      navigate(PATHS.teamDetail(teamId))
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  return (
    <Section
      title="我的团队"
      aside={
        <div className="row">
          <Button
            variant="quiet"
            onClick={() => navigate(PATHS.CREATE_TEAM)}
            icon={<Icon name="plus" size={15} />}
          >
            创建团队
          </Button>
          <Button
            variant="quiet"
            onClick={() => navigate(PATHS.JOIN_TEAM)}
            icon={<Icon name="people" size={15} />}
          >
            加入团队
          </Button>
        </div>
      }
    >
      {teams.isPending ? (
        <Skeleton rows={3} />
      ) : teams.isError ? (
        <EmptyState
          title="团队列表加载失败"
          description={formatApiError(teams.error)}
          action={
            <Button
              variant="link"
              onClick={() => void teams.refetch()}
              icon={<Icon name="refresh" size={15} />}
            >
              重试
            </Button>
          }
          stacked
        />
      ) : teams.data.length === 0 ? (
        <EmptyState icon="people" title="还没有加入任何团队" stacked />
      ) : (
        <ul className="teamlist">
          {teams.data.map((team) => {
            const current = team.id === currentTeamId
            return (
              <li key={team.id} className={`teamrow${current ? ' teamrow--current' : ''}`}>
                <span className="teamrow__id">
                  <span className="teamrow__mono" aria-hidden>
                    {team.name.trim().slice(0, 1) || '·'}
                  </span>
                  <span className="teamrow__name">{team.name}</span>
                </span>
                <span className="meta">
                  {team.description ||
                    (team.memberCount ? `${team.memberCount} 名成员` : '团队成员')}
                </span>
                {current ? (
                  <Tag tone="ok">当前团队</Tag>
                ) : (
                  <Button
                    variant="quiet"
                    aria-label={`切换到${team.name}`}
                    icon={<Icon name="check" size={15} />}
                    disabled={select.isPending}
                    onClick={() => select.mutate(team.id)}
                  >
                    {select.isPending && select.variables === team.id ? '切换中…' : '切换'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function Security() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  function signOutTo(path: string) {
    void logout().then(() => navigate(path, { replace: true }))
  }

  return (
    <Section title="安全">
      <div className="kv">
        <div className="kv__row">
          <span className="kv__k">登录密码</span>
          <span className="kv__v">
            <Button
              variant="quiet"
              onClick={() => navigate(PATHS.FORGOT_PASSWORD)}
              icon={<Icon name="refresh" size={15} />}
            >
              重置密码
            </Button>
          </span>
        </div>
        <div className="kv__row">
          <span className="kv__k">当前账号</span>
          <span className="kv__v mono">{user?.email ?? '—'}</span>
        </div>
        <div className="kv__row">
          <span className="kv__k">退出登录</span>
          <span className="kv__v">
            <Button
              variant="quiet"
              onClick={() => signOutTo(PATHS.LOGIN)}
              icon={<Icon name="logout" size={15} />}
            >
              退出登录
            </Button>
          </span>
        </div>
      </div>
    </Section>
  )
}

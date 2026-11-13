import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { App, Avatar, Button, Input, Popover, Select, Spin, Upload } from 'antd'
import {
  CameraOutlined,
  CheckOutlined,
  EditOutlined,
  LogoutOutlined,
  PlusOutlined,
  SettingOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { authApi, teamApi, uploadAvatar } from '@/api'
import { useAppUiStore, useCurrentTeamId } from '@/store/appUiStore'
import { formatApiError } from '@/utils/formatApiError'
import { PATHS } from '@/routes/paths'
import './PersonalCenter.css'

/**
 * 头像菜单：改昵称与头像、切换/创建/加入团队、进入设置、退出登录。
 * 团队切换只有服务端保存成功才改当前团队并进入该团队；失败停在原团队，不丢当前项目上下文。
 */
export function PersonalCenter() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { message } = App.useApp()
  const { user, logout, updateUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nickname, setNickname] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const name = user?.displayName || '用户'
  const currentTeamId = useCurrentTeamId()
  const teams = useQuery({ queryKey: ['teams', 'mine'], queryFn: teamApi.listMine })
  // 从项目里进设置时带上回程地址（含群定位），设置页据此提供「返回项目」。
  const returnTo = pathname.startsWith('/app/projects/') ? pathname + search : null
  const settingsHref = returnTo
    ? `${PATHS.SETTINGS}?returnTo=${encodeURIComponent(returnTo)}`
    : PATHS.SETTINGS

  const selectTeam = useMutation({
    mutationFn: (teamId: string) => authApi.selectTeam(teamId),
    onSuccess: (_data, teamId) => {
      useAppUiStore.getState().setCurrentTeam(teamId)
      setOpen(false)
      navigate(PATHS.teamDetail(teamId))
    },
    onError: (error) => message.error(formatApiError(error)),
  })

  const updateProfile = useMutation({
    mutationFn: (displayName: string) => authApi.updateMe({ displayName }),
    onSuccess: (updated) => {
      updateUser(updated)
      setEditingName(false)
      message.success('昵称已更新')
    },
    onError: (error) => message.error(formatApiError(error)),
  })

  async function handleAvatarUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      message.warning('仅支持图片文件')
      return false
    }
    if (file.size > 5 * 1024 * 1024) {
      message.warning('图片不超过 5MB')
      return false
    }
    setAvatarUploading(true)
    try {
      const avatarUrl = await uploadAvatar(file)
      if (user) updateUser({ ...user, avatarUrl })
      message.success('头像已更新')
    } catch (error) {
      message.error(formatApiError(error))
    } finally {
      setAvatarUploading(false)
    }
    return false
  }

  function saveNickname() {
    const displayName = nickname.trim()
    if (!displayName || updateProfile.isPending) return
    if (displayName === name) {
      setEditingName(false)
      return
    }
    updateProfile.mutate(displayName)
  }

  const content = (
    <section className="personal-menu" aria-label="个人中心">
      <div className="personal-menu__profile">
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={handleAvatarUpload}
          disabled={avatarUploading}
        >
          <button
            type="button"
            className="personal-menu__avatar"
            aria-label="更换个人头像"
            disabled={avatarUploading}
          >
            <Avatar size={60} src={user?.avatarUrl}>
              {name.slice(0, 1)}
            </Avatar>
            <span className={`personal-menu__avatar-mask${avatarUploading ? ' is-visible' : ''}`}>
              {avatarUploading ? <Spin size="small" /> : <CameraOutlined />}
            </span>
          </button>
        </Upload>
        <div className="personal-menu__identity">
          {editingName ? (
            <div className="personal-menu__name-editor">
              <Input
                autoFocus
                aria-label="昵称"
                maxLength={120}
                value={nickname}
                disabled={updateProfile.isPending}
                onChange={(event) => setNickname(event.target.value)}
                onPressEnter={saveNickname}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setEditingName(false)
                }}
              />
              <Button
                type="text"
                icon={<CheckOutlined />}
                aria-label="保存昵称"
                loading={updateProfile.isPending}
                disabled={!nickname.trim()}
                onClick={saveNickname}
              />
            </div>
          ) : (
            <button
              type="button"
              className="personal-menu__name"
              aria-label="修改昵称"
              onClick={() => {
                setNickname(name)
                setEditingName(true)
              }}
            >
              <strong>{name}</strong>
              <EditOutlined />
            </button>
          )}
          <span className="personal-menu__email">{user?.email}</span>
        </div>
      </div>
      <div className="personal-menu__teams">
        <label className="personal-menu__label" htmlFor="personal-team-select">
          团队
        </label>
        <Select
          id="personal-team-select"
          className="personal-menu__team-select"
          showSearch
          optionFilterProp="label"
          value={currentTeamId ?? undefined}
          placeholder={teams.isPending ? '正在加载团队…' : '选择团队'}
          options={(teams.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
          loading={teams.isPending}
          disabled={teams.isPending || selectTeam.isPending || teams.data?.length === 0}
          notFoundContent={teams.isPending ? '正在加载…' : '没有匹配的团队'}
          popupMatchSelectWidth={280}
          onChange={(teamId) => {
            if (teamId !== currentTeamId) selectTeam.mutate(teamId)
          }}
          optionRender={(option) => (
            <span className="personal-menu__team-option">
              <span>{option.label}</span>
              {option.value === currentTeamId && <em>当前</em>}
            </span>
          )}
        />
        {teams.isError && (
          <Button size="small" onClick={() => void teams.refetch()}>
            重新加载团队
          </Button>
        )}
      </div>
      <div className="personal-menu__actions">
        <button
          type="button"
          className="personal-menu__item"
          onClick={() => {
            setOpen(false)
            navigate(PATHS.CREATE_TEAM)
          }}
        >
          <PlusOutlined />
          <span>创建团队</span>
        </button>
        <button
          type="button"
          className="personal-menu__item"
          onClick={() => {
            setOpen(false)
            navigate(PATHS.JOIN_TEAM)
          }}
        >
          <UsergroupAddOutlined />
          <span>加入团队</span>
        </button>
        <button
          type="button"
          className="personal-menu__item"
          onClick={() => {
            setOpen(false)
            navigate(settingsHref)
          }}
        >
          <SettingOutlined />
          <span>设置</span>
        </button>
        <button
          type="button"
          className="personal-menu__item personal-menu__item--logout"
          onClick={async () => {
            await logout()
            setOpen(false)
            navigate(PATHS.LOGIN, { replace: true })
          }}
        >
          <LogoutOutlined />
          <span>退出登录</span>
        </button>
      </div>
    </section>
  )

  return (
    <Popover
      placement="bottomRight"
      trigger="click"
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setEditingName(false)
      }}
      content={content}
      arrow={false}
      styles={{ container: { padding: 0 } }}
    >
      <Button type="text" aria-label="打开个人中心" className="personal-menu__trigger">
        <span className="qg-banner__user-name">{name}</span>
        <Avatar size={32} src={user?.avatarUrl}>
          {name.slice(0, 1)}
        </Avatar>
      </Button>
    </Popover>
  )
}

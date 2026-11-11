import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, App, Avatar, Button, Grid, Input, Popover, Spin, Upload } from 'antd'
import {
  CameraOutlined,
  CheckOutlined,
  EditOutlined,
  LogoutOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useAuth } from '@/context/AuthContext'
import { authApi, teamApi, uploadAvatar } from '@/api'
import { useAppUiStore, useCurrentTeamId } from '@/store/appUiStore'
import { formatApiError } from '@/utils/formatApiError'
import { PATHS } from '@/routes/paths'
import './PersonalCenter.css'

/** 头像菜单：资料就地编辑，不遮挡当前页面。 */
export function PersonalCenter() {
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const { message } = App.useApp()
  const { user, logout, updateUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nickname, setNickname] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const name = user?.displayName || '用户'
  const teamId = useCurrentTeamId()
  const teams = useQuery({ queryKey: ['teams', 'mine'], queryFn: teamApi.listMine, enabled: open })
  const selectTeam = useMutation({
    mutationFn: (id: string) => authApi.selectTeam(id),
    onSuccess: (_data, id) => {
      useAppUiStore.getState().setCurrentTeam(id)
      setOpen(false)
      navigate(PATHS.teamDetail(id))
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

  const teamMenu = (
    <section className="personal-menu__teams" aria-label="选择团队">
      {teams.isPending ? (
        <div className="personal-menu__team-status">
          <Spin delay={180} />
        </div>
      ) : teams.isError ? (
        <Alert
          type="error"
          title="团队加载失败"
          action={<Button onClick={() => void teams.refetch()}>重试</Button>}
        />
      ) : teams.data?.length ? (
        teams.data.map((team) => (
          <button
            type="button"
            key={team.id}
            className={`personal-menu__team${team.id === teamId ? ' is-current' : ''}`}
            aria-label={`进入团队 ${team.name}`}
            aria-current={team.id === teamId ? 'true' : undefined}
            disabled={selectTeam.isPending}
            onClick={() => selectTeam.mutate(team.id)}
          >
            <Avatar size={36} src={team.avatarUrl}>
              {team.name.slice(0, 1)}
            </Avatar>
            <span>{team.name}</span>
            {team.id === teamId && <CheckOutlined />}
          </button>
        ))
      ) : (
        <p className="personal-menu__team-status">还没有团队</p>
      )}
    </section>
  )

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
      <div className="personal-menu__actions">
        <Popover
          placement={screens.sm ? 'leftTop' : 'bottom'}
          trigger={['hover', 'click']}
          content={teamMenu}
          arrow={false}
          styles={{ container: { padding: 8 } }}
        >
          <button type="button" className="personal-menu__item" aria-label="切换团队">
            <TeamOutlined />
            <span>切换团队</span>
            <RightOutlined className="personal-menu__arrow" />
          </button>
        </Popover>
        {teamId && (
          <button
            type="button"
            className="personal-menu__item"
            onClick={() => {
              setOpen(false)
              navigate(PATHS.teamSettings(teamId))
            }}
          >
            <SettingOutlined />
            <span>团队设置</span>
          </button>
        )}
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
          <TeamOutlined />
          <span>加入团队</span>
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

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { App, Avatar, Button, Dropdown, type MenuProps } from 'antd'
import { CheckOutlined, DownOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons'
import { authApi, teamApi } from '@/api'
import { useAppUiStore, useCurrentTeamId } from '@/store/appUiStore'
import { formatApiError } from '@/utils/formatApiError'
import { PATHS } from '@/routes/paths'
import './TeamSelector.css'

/** 顶部团队选择器：切换团队、创建或加入团队都在团队上下文里完成。 */
export function TeamSelector() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const teamId = useCurrentTeamId()
  const [open, setOpen] = useState(false)
  const teams = useQuery({
    queryKey: ['teams', 'mine'],
    queryFn: teamApi.listMine,
  })
  const current = teams.data?.find((team) => team.id === teamId)
  const selectTeam = useMutation({
    mutationFn: (id: string) => authApi.selectTeam(id),
    onSuccess: (_data, id) => {
      useAppUiStore.getState().setCurrentTeam(id)
      setOpen(false)
      navigate(PATHS.teamDetail(id))
    },
    onError: (error) => void message.error(formatApiError(error)),
  })

  const items: MenuProps['items'] = [
    ...(teams.isPending && !teams.data
      ? [{ key: 'loading', label: '正在加载团队…', disabled: true }]
      : teams.isError
        ? [{ key: 'retry', label: '团队加载失败，点击重试' }]
        : (teams.data ?? []).map((team) => ({
            key: team.id,
            label: (
              <span
                className="team-selector__option"
                aria-current={team.id === teamId ? 'true' : undefined}
              >
                <Avatar size={24} src={team.avatarUrl}>
                  {team.name.slice(0, 1)}
                </Avatar>
                <span>{team.name}</span>
                {team.id === teamId && (
                  <span className="team-selector__current">
                    <CheckOutlined aria-hidden /> 当前
                  </span>
                )}
              </span>
            ),
          }))),
    { type: 'divider' },
    { key: 'create', icon: <PlusOutlined />, label: '创建团队' },
    { key: 'join', icon: <TeamOutlined />, label: '加入团队' },
  ]

  function handleMenuClick({ key }: { key: string }) {
    if (key === 'create') {
      setOpen(false)
      navigate(PATHS.CREATE_TEAM)
      return
    }
    if (key === 'join') {
      setOpen(false)
      navigate(PATHS.JOIN_TEAM)
      return
    }
    if (key === 'retry') {
      void teams.refetch()
      return
    }
    if (key === 'loading') return
    selectTeam.mutate(key)
  }

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomLeft"
      open={open}
      onOpenChange={setOpen}
      menu={{ items, onClick: handleMenuClick, selectable: false }}
    >
      <Button
        type="text"
        className="team-selector"
        aria-label={current ? `当前团队 ${current.name}，切换团队` : '切换团队'}
        disabled={selectTeam.isPending}
      >
        <Avatar size={24} src={current?.avatarUrl}>
          {current?.name.slice(0, 1) ?? <TeamOutlined />}
        </Avatar>
        <span className="team-selector__name">{current?.name ?? '选择团队'}</span>
        <DownOutlined className="team-selector__chevron" aria-hidden />
      </Button>
    </Dropdown>
  )
}

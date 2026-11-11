import { useEffect } from 'react'
import { App } from 'antd'
import { authApi } from '@/api/auth'
import { useAppUiStore } from '@/store/appUiStore'
import { formatApiError } from '@/utils/formatApiError'

/** 直接打开团队或项目链接时也记住其团队，供下次登录恢复。 */
export function useRememberTeam(teamId?: string) {
  const { message } = App.useApp()
  useEffect(() => {
    if (!teamId || useAppUiStore.getState().currentTeamId === teamId) return
    let cancelled = false
    authApi
      .selectTeam(teamId)
      .then(() => {
        if (!cancelled) useAppUiStore.getState().setCurrentTeam(teamId)
      })
      .catch((error) => {
        if (!cancelled) message.error(formatApiError(error))
      })
    return () => {
      cancelled = true
    }
  }, [teamId, message])
}

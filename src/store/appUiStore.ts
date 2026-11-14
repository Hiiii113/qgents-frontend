import { create } from 'zustand'

interface AppUiStore {
  /** 最近选择的团队；由 GET /me 恢复，切换团队时写回服务端。 */
  currentTeamId: string | null
  setCurrentTeam: (teamId: string | null) => void
  clearContext: () => void
  /** 窄屏群聊列的覆盖层开关；只在聊天页有内容。 */
  chatContextOpen: boolean
  setChatContextOpen: (open: boolean) => void
}

export const useAppUiStore = create<AppUiStore>((set) => ({
  currentTeamId: null,
  setCurrentTeam: (currentTeamId) => set({ currentTeamId }),
  clearContext: () => set({ currentTeamId: null }),
  chatContextOpen: false,
  setChatContextOpen: (chatContextOpen) => set({ chatContextOpen }),
}))

export const useCurrentTeamId = () => useAppUiStore((state) => state.currentTeamId)

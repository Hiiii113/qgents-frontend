import { create } from 'zustand'
interface AppUiStore {
  currentTeamId: string | null
  setCurrentTeam: (teamId: string | null) => void
  clearContext: () => void
}
export const useAppUiStore = create<AppUiStore>(set => ({
  currentTeamId: null,
  setCurrentTeam: (currentTeamId) => set({ currentTeamId }),
  clearContext: () => set({ currentTeamId: null }),
}))
export const useCurrentTeamId = () => useAppUiStore(state => state.currentTeamId)

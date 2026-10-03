import { createContext, useContext } from 'react'

export interface PersonalCenterContextValue {
  open: boolean
  openPersonalCenter: () => void
  closePersonalCenter: () => void
  togglePersonalCenter: () => void
}

export const PersonalCenterContext = createContext<PersonalCenterContextValue | null>(null)

export function usePersonalCenter() {
  const ctx = useContext(PersonalCenterContext)
  if (!ctx) {
    throw new Error('usePersonalCenter must be used within PersonalCenterProvider')
  }
  return ctx
}

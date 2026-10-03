import { PersonalCenterContext } from './PersonalCenterContext'
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export function PersonalCenterProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const openPersonalCenter = useCallback(() => setOpen(true), [])
  const closePersonalCenter = useCallback(() => setOpen(false), [])
  const togglePersonalCenter = useCallback(() => setOpen((v) => !v), [])

  const value = useMemo(
    () => ({ open, openPersonalCenter, closePersonalCenter, togglePersonalCenter }),
    [open, openPersonalCenter, closePersonalCenter, togglePersonalCenter],
  )

  return (
    <PersonalCenterContext.Provider value={value}>{children}</PersonalCenterContext.Provider>
  )
}


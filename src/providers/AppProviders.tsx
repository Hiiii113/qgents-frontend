import { App as AntdApp, ConfigProvider } from 'antd'
import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { AuthProvider } from '@/context/AuthProvider'
import { queryClient } from '@/query'
import { antdTheme } from '@/theme/antdTheme'
import { PageLoader } from '@/components/PageLoader'

function BootstrapGate({ children }: { children: ReactNode }) {
  const { isBootstrapping } = useAuth()

  if (isBootstrapping) {
    return <PageLoader fullscreen />
  }

  return <>{children}</>
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={antdTheme}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BootstrapGate>{children}</BootstrapGate>
          </AuthProvider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  )
}

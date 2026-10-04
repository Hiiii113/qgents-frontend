import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { App } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
export function renderWorkspace(element: ReactNode, path: string, route: string, seed: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } })
  seed(client)
  return { client, ...render(<QueryClientProvider client={client}><App><MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element} /></Routes></MemoryRouter></App></QueryClientProvider>) }
}

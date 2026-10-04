import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { agentApi } from '@/api'
import { useAgents } from './agents'
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
afterEach(() => { client.clear(); vi.restoreAllMocks() })
describe('team Agent cache', () => {
  it('waits for the project team context before requesting', () => {
    const spy = vi.spyOn(agentApi, 'list')
    renderHook(() => useAgents(), { wrapper })
    expect(spy).not.toHaveBeenCalled()
  })
  it('loads team Agents and shares the cache across projects in that team', async () => {
    const spy = vi.spyOn(agentApi, 'list').mockResolvedValue([])
    const first = renderHook(() => useAgents('t1'), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    const second = renderHook(() => useAgents('t1'), { wrapper })
    expect(second.result.current.data).toEqual(first.result.current.data)
    expect(spy).toHaveBeenCalledWith('t1')
  })
})

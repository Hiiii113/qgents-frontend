import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { memoryApi } from '@/api'
import type { ProjectMemory } from '@/types'
import { MemoryPage } from './MemoryPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const memory: ProjectMemory = {
  projectId: 'p1',
  content: '旧内容',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function open(path = '/app/projects/p1/memory', content: ProjectMemory | null = memory) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  if (content) client.setQueryData(['memory', 'p1'], content)
  return render(
    <QueryClientProvider client={client}>
      <App>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/projects/:projectId/memory" element={<MemoryPage />} />
          </Routes>
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  )
}

it('shows the project memory title and keeps meta inside the document', () => {
  open()
  expect(screen.getByRole('heading', { name: '项目记忆' })).toBeInTheDocument()
  expect(screen.queryByText(/memory\.md 是项目长期记忆/)).not.toBeInTheDocument()
  expect(screen.getByText('旧内容')).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /编\s*辑/ })).not.toBeInTheDocument()
  expect(screen.getByText('3 字符').closest('article')).toBeInTheDocument()
  expect(screen.getByText(/最后修改/).closest('article')).toBeInTheDocument()
})

it('offers an empty state for a project without memory', () => {
  open('/app/projects/p1/memory', { ...memory, content: '', updatedAt: null })
  expect(screen.getByText(/项目还没有记录长期记忆/)).toBeInTheDocument()
  expect(screen.queryByText(/最后修改/)).not.toBeInTheDocument()
})

it('retries after the memory request fails', async () => {
  const get = vi
    .spyOn(memoryApi, 'get')
    .mockRejectedValueOnce(new Error('网络中断'))
    .mockResolvedValue(memory)
  open('/app/projects/p1/memory', null)
  expect(await screen.findByText('网络中断')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }))
  expect(await screen.findByText('旧内容')).toBeInTheDocument()
  expect(get).toHaveBeenCalledTimes(2)
})

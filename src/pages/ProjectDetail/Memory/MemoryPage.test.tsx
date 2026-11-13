import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { memoryApi } from '@/api'
import { ApiError } from '@/api/client'
import { renderWorkspace } from '@/test/renderWorkspace'
import { MemoryPage } from './MemoryPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const memory = {
  projectId: 'p1',
  content: '旧内容',
  version: 'v1',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function open(role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER' = 'PROJECT_ADMIN') {
  return renderWorkspace(
    <MemoryPage />,
    '/app/projects/p1/memory',
    '/app/projects/:projectId/memory',
    (client) => {
      client.setQueryData(['projects', 'p1'], {
        id: 'p1',
        teamId: 't1',
        name: '项目',
        role,
      })
      client.setQueryData(['memory', 'p1'], memory)
    },
  )
}

it('keeps the captured version and draft when the server content refreshes during editing', async () => {
  const save = vi.spyOn(memoryApi, 'save').mockRejectedValue(
    new ApiError('版本冲突', 409, {
      error: { code: 'MEMORY_VERSION_CONFLICT', message: '内容已被更新' },
    }),
  )
  const view = open()
  expect(screen.getByText('旧内容')).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: '项目记忆内容' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /^编\s*辑$/ }))
  const editor = screen.getByRole('textbox', { name: '项目记忆内容' })
  expect(editor).toHaveValue('旧内容')
  fireEvent.change(editor, { target: { value: '我的草稿' } })

  // 后台刷新拿到新版本，但用户正在编辑的草稿与保存基准不能被替换。
  view.client.setQueryData(['memory', 'p1'], {
    ...memory,
    content: '服务器新版',
    version: 'v2',
  })
  expect(editor).toHaveValue('我的草稿')

  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }))
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith('p1', { content: '我的草稿', version: 'v1' }),
  )
  expect(await screen.findByText('内容已被更新，草稿仍保留')).toBeInTheDocument()
  expect(editor).toHaveValue('我的草稿')

  fireEvent.click(screen.getByRole('button', { name: '取消编辑' }))
  expect(screen.queryByRole('textbox', { name: '项目记忆内容' })).not.toBeInTheDocument()
  expect(screen.getByText('服务器新版')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^编\s*辑$/ })).toBeInTheDocument()
})

it('confirms before reloading over an unsaved draft', async () => {
  const latest = { ...memory, content: '服务器最新', version: 'v3' }
  vi.spyOn(memoryApi, 'get').mockResolvedValue(latest)
  open()
  fireEvent.click(screen.getByRole('button', { name: /^编\s*辑$/ }))
  const editor = screen.getByRole('textbox', { name: '项目记忆内容' })
  fireEvent.change(editor, { target: { value: '未保存草稿' } })

  const toolbar = () => within(document.querySelector('.memory-page__actions') as HTMLElement)
  fireEvent.click(toolbar().getByRole('button', { name: /重新加载/ }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getAllByText('放弃未保存的修改？').length).toBeGreaterThan(0)
  fireEvent.click(within(dialog).getByRole('button', { name: '继续编辑' }))
  expect(editor).toHaveValue('未保存草稿')
})

it('reloads the latest content after the user confirms discarding the draft', async () => {
  const latest = { ...memory, content: '服务器最新', version: 'v3' }
  vi.spyOn(memoryApi, 'get').mockResolvedValue(latest)
  open()
  fireEvent.click(screen.getByRole('button', { name: /^编\s*辑$/ }))
  fireEvent.change(screen.getByRole('textbox', { name: '项目记忆内容' }), {
    target: { value: '未保存草稿' },
  })
  fireEvent.click(screen.getByRole('button', { name: /重新加载/ }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: /重新加载/ }))
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: '项目记忆内容' })).not.toBeInTheDocument(),
  )
  expect(await screen.findByText('服务器最新')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^编\s*辑$/ })).toBeInTheDocument()
})

it('keeps ordinary project members in read-only mode', () => {
  open('PROJECT_MEMBER')
  expect(screen.getByText('旧内容')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^编\s*辑$/ })).not.toBeInTheDocument()
  expect(screen.getByText(/项目记忆只有项目管理员可以编辑/)).toBeInTheDocument()
})

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Skeleton } from './Layout'

describe('skeleton', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('只在超过 300ms 后出现，并向读屏宣布加载', () => {
    render(<Skeleton />)
    expect(screen.queryByRole('status')).toBeNull()

    act(() => vi.advanceTimersByTime(299))
    expect(screen.queryByRole('status')).toBeNull()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('status', { name: '正在加载' })).toBeInTheDocument()
  })
})

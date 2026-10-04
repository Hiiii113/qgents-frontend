import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageLoader } from './PageLoader'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('page loading feedback', () => {
  it('shows the spinner only when loading lasts at least 180 ms', () => {
    vi.useFakeTimers()
    const { container } = render(<PageLoader />)
    expect(container.querySelector('.ant-spin-spinning')).toBeNull()
    act(() => vi.advanceTimersByTime(179))
    expect(container.querySelector('.ant-spin-spinning')).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(container.querySelector('.ant-spin-spinning')).not.toBeNull()
  })

  it('cancels pending feedback when a short load finishes', () => {
    vi.useFakeTimers()
    const { container, unmount } = render(<PageLoader fullscreen />)
    act(() => vi.advanceTimersByTime(100))
    unmount()
    act(() => vi.advanceTimersByTime(180))
    expect(container).toBeEmptyDOMElement()
  })
})

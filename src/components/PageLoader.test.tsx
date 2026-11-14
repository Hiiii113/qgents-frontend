import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageLoader } from './PageLoader'

describe('page loading feedback', () => {
  it('announces loading and marks fullscreen mode', () => {
    const { container } = render(<PageLoader fullscreen />)
    expect(screen.getByRole('status', { name: '加载中' })).toBeInTheDocument()
    expect(container.querySelector('.page-loader--fullscreen')).not.toBeNull()
  })
})

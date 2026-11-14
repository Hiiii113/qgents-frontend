import '@testing-library/jest-dom/vitest'

// jsdom 不提供滚动定位；候选菜单的实际滚动行为在浏览器中验证。
if (typeof HTMLElement.prototype.scrollIntoView !== 'function') {
  HTMLElement.prototype.scrollIntoView = () => undefined
}

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })
}

// jsdom 没有实现 <dialog> 的模态方法；设计系统 Dialog 在浏览器里走原生 showModal/close。
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  class TestResizeObserver implements ResizeObserver {
    disconnect(): void {}
    observe(_target: Element, _options?: ResizeObserverOptions): void {}
    unobserve(_target: Element): void {}
  }
  globalThis.ResizeObserver = TestResizeObserver
}

/**
 * Vitest 全局 setup
 * TODO: 联调阶段可在此启用 MSW（src/mocks/browser.ts）
 */

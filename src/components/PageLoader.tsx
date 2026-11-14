import './PageLoader.css'

/** 页面加载：三条呼吸的软灰条，不用转圈。 */
export function PageLoader({ fullscreen = false }: { fullscreen?: boolean }) {
  return (
    <div
      className={`page-loader${fullscreen ? ' page-loader--fullscreen' : ''}`}
      role="status"
      aria-label="加载中"
    >
      <div className="page-loader__bars" aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

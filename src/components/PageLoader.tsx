import { Spin } from 'antd'
import './PageLoader.css'

/** 页面加载保持原有背景，快速完成的请求不显示转圈图标。 */
export function PageLoader({ fullscreen = false }: { fullscreen?: boolean }) {
  return (
    <div
      className={`qg-page-loader${fullscreen ? ' qg-page-loader--fullscreen' : ''}`}
      role="status"
      aria-label="加载中"
    >
      <Spin size="large" delay={180} />
    </div>
  )
}

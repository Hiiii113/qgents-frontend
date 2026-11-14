import { useEffect, useState } from 'react'
import { getStoredToken } from '@/api/client'

interface AuthedImageProps {
  /** 鉴权内容地址：需要 Bearer token，<img> 无法自带，所以先 fetch 成 objectURL。 */
  src?: string | null
  alt: string
  className?: string
}

/** 带鉴权的图片加载：先带 token 取 Blob，再交给 <img>。 */
export function AuthedImage({ src, alt, className }: AuthedImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!src) {
      setObjectUrl(null)
      return
    }
    let url: string | null = null
    let cancelled = false
    const controller = new AbortController()
    const token = getStoredToken()
    fetch(src, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.blob()
      })
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setObjectUrl(url)
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null)
      })
    return () => {
      cancelled = true
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [src])

  if (!objectUrl) return null
  return <img className={className} src={objectUrl} alt={alt} loading="lazy" />
}

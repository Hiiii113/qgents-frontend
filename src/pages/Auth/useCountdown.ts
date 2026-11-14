import { useEffect, useRef, useState } from 'react'

/** 发送验证码后的 60 秒倒计时；卸载时清理定时器。 */
export function useCountdown(seconds = 60) {
  const [left, setLeft] = useState(0)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current)
    },
    [],
  )

  const start = () => {
    setLeft(seconds)
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          if (timer.current !== null) window.clearInterval(timer.current)
          timer.current = null
          return 0
        }
        return value - 1
      })
    }, 1000)
  }

  return { left, start }
}

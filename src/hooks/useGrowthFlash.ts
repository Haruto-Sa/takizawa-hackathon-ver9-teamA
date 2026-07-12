import { useCallback, useEffect, useRef, useState } from 'react'

// AI反映・記録保存後の一時発光。永続ステータスとは分離した揮発状態。
export function useGrowthFlash() {
  const [recentlyUpdatedIds, setIds] = useState<Set<string>>(new Set())
  const timers = useRef<number[]>([])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])
  const flash = useCallback((ids: string[], ms = 2600) => {
    if (ids.length === 0) return
    setIds((prev) => new Set([...prev, ...ids]))
    timers.current.push(window.setTimeout(() => {
      setIds((prev) => {
        const next = new Set(prev)
        ids.forEach((i) => next.delete(i))
        return next
      })
    }, ms))
  }, [])
  return { recentlyUpdatedIds, flash }
}

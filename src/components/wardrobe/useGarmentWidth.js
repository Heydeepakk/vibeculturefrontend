import { useEffect, useState } from 'react'

// Garment width in px from the viewport size. Only a width change (rotation, window resize) recomputes it:
// on phones the URL bar showing/hiding while scrolling changes the height constantly, and re-laying out
// every rack mid-scroll is what made it stutter.
const useGarmentWidth = (fn) => {
  const calc = () => Math.round(fn(window.innerWidth, window.innerHeight))
  const [w, setW] = useState(calc)
  useEffect(() => {
    let lastW = window.innerWidth
    let raf = 0
    const onResize = () => {
      if (window.innerWidth === lastW) return
      lastW = window.innerWidth
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setW(calc()))
    }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf) }
  }, [])
  return w
}

export default useGarmentWidth

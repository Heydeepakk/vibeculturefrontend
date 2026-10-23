import { useEffect, useState } from 'react'

// Garment width in px from the viewport size, recomputed on resize.
const useGarmentWidth = (fn) => {
  const calc = () => Math.round(fn(window.innerWidth, window.innerHeight))
  const [w, setW] = useState(calc)
  useEffect(() => {
    const onResize = () => setW(calc())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return w
}

export default useGarmentWidth

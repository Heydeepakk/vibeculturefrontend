// Phones and small tablets get a lighter wardrobe: same motion, far fewer pixels to repaint per frame.
const mq = q => typeof window !== 'undefined' && window.matchMedia?.(q).matches
export const LITE = typeof window !== 'undefined' && (
  mq('(pointer: coarse)') || window.innerWidth < 768 ||
  (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4
)

// While a full-screen overlay (fitting room) is open, the racks behind it stop animating.
let overlays = 0
export const overlayOpen = () => overlays > 0
export const pushOverlay = () => { overlays++; return () => { overlays = Math.max(0, overlays - 1) } }

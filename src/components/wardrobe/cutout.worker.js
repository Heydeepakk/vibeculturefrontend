import { processImage } from './cutoutCore'

// Cuts garment photos out off the main thread, so scrolling and the rack animations never wait on it.
const supported = (() => {
  try { return !!new OffscreenCanvas(1, 1).getContext('2d') } catch { return false }
})()

self.onmessage = async ({ data: { id, url } }) => {
  if (!supported) { self.postMessage({ id, unsupported: true }); return }
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(res.status)
    const bmp = await createImageBitmap(await res.blob())
    const out = await processImage(bmp)
    bmp.close?.()
    self.postMessage({ id, out })
  } catch {
    self.postMessage({ id, out: null })
  }
}

import { useEffect, useState } from 'react'
import { processImage } from './cutoutCore'
import { LITE } from './perf'

// Removes plain white / light-grey studio backgrounds from product photos, in the browser.
// Flood-fills from the image border, so white areas *inside* the garment are kept.
// Photos without a plain background (lifestyle shots) are returned untouched.
// For cut garments it also builds a "core" texture (the silhouette filled with the fabric's edge colour),
// which is stacked in depth to give the garment a real side profile, and finds the waistband span.

const results = new Map() // src -> { src, cut }
const pending = new Map() // src -> Promise
const queue = []
let busy = false

// ask Cloudinary for a smaller copy; processing a 700px image is fast and plenty sharp
// (phones get a smaller copy: it is shown smaller and cuts out twice as fast)
export const sizedUrl = (url, w = LITE ? 600 : 800) =>
  url && url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/w_')
    ? url.replace('/upload/', `/upload/w_${w},c_limit,q_auto/`)
    : url

const loadImage = src => new Promise((resolve, reject) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.decoding = 'async'
  img.onload = () => resolve(img)
  img.onerror = reject
  img.src = src
})

// blobs from processImage -> URLs the page can show
const toResult = (src, out) => {
  if (!out?.cut || !out.blob) return { src, cut: false, aspect: out?.aspect }
  return {
    src: URL.createObjectURL(out.blob),
    core: out.coreBlob ? URL.createObjectURL(out.coreBlob) : null,
    sideTex: out.leftBlob && out.rightBlob ? { left: URL.createObjectURL(out.leftBlob), right: URL.createObjectURL(out.rightBlob) } : null,
    outline: out.outline,
    cut: true,
    aspect: out.aspect,
    waist: out.waist,
  }
}

// Preferred path: a worker does the download, decode and pixel work.
let worker = null
let workerOk = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined'
const waiting = new Map() // id -> { src, resolve }
let nextId = 0
const getWorker = () => {
  if (worker || !workerOk) return worker
  try {
    worker = new Worker(new URL('./cutout.worker.js', import.meta.url), { type: 'module' })
  } catch { workerOk = false; return null }
  worker.onmessage = ({ data: { id, out, unsupported } }) => {
    const job = waiting.get(id)
    if (!job) return
    waiting.delete(id)
    if (unsupported) { workerOk = false; enqueue(job.src, job.resolve); return }
    job.resolve(toResult(job.src, out))
  }
  worker.onerror = () => {
    // worker failed to start: hand everything still waiting to the main-thread path
    workerOk = false
    worker = null
    const jobs = [...waiting.values()]
    waiting.clear()
    jobs.forEach(j => enqueue(j.src, j.resolve))
  }
  return worker
}

// Fallback path (old browsers): one image at a time on the page, yielding between images.

const enqueue = (src, resolve) => {
  const item = { src, resolve, settled: false }
  item.img = loadImage(sizedUrl(src))
  item.img.catch(() => {}).finally(() => { item.settled = true; pump() })
  queue.push(item)
}

// true while photos are being cut out on the main thread (motion holds still so this finishes quickly)
export const cutoutsBusy = () => busy

// process whichever downloaded image is ready first, one at a time
const pump = () => {
  if (busy) return
  const idx = queue.findIndex(item => item.settled)
  if (idx < 0) return
  busy = true
  const { src, img, resolve } = queue.splice(idx, 1)[0]
  img.then(processImage)
    .then(out => toResult(src, out))
    .catch(() => ({ src, cut: false }))
    .then(res => resolve(res))
    .finally(() => { busy = false; setTimeout(pump, 16) })
}

export const getCutout = (src) => {
  if (!src) return Promise.resolve(null)
  if (results.has(src)) return Promise.resolve(results.get(src))
  if (!pending.has(src)) {
    pending.set(src, new Promise(resolve => {
      const done = res => { results.set(src, res); resolve(res) }
      const w = getWorker()
      if (w) {
        const id = nextId++
        waiting.set(id, { src, resolve: done })
        w.postMessage({ id, url: sizedUrl(src) })
      } else {
        enqueue(src, done)
      }
    }))
  }
  return pending.get(src)
}

// Returns null while processing, then { src, cut }.
export const useCutout = (src) => {
  const [res, setRes] = useState(() => (src && results.get(src)) || null)
  useEffect(() => {
    let alive = true
    if (!src) { setRes(null); return }
    if (results.has(src)) { setRes(results.get(src)); return }
    setRes(null)
    getCutout(src).then(r => alive && setRes(r))
    return () => { alive = false }
  }, [src])
  return res
}

// The four racks / hangers. Must match hangerOf() in the admin (admincode/src/utils/hangers.js).
export const RACKS = {
  tshirt: { title: 'T-Shirts & Tops', note: 'On wooden shoulder hangers' },
  lowers: { title: 'Lowers', note: 'Clipped by the waistband' },
  jeans: { title: 'Jeans', note: 'Held in a clamp hanger' },
  underwear: { title: 'Underwear', note: 'On mini clip hangers' },
}

export const garmentKind = (category) => {
  const style = category?.hangerStyle
  if (style === 'top') return 'tshirt'
  if (style === 'bottom') return 'lowers'
  if (RACKS[style]) return style
  const name = (category?.name || '').toLowerCase()
  if (/underwear|boxer|brief|trunk|innerwear|vest/.test(name)) return 'underwear'
  if (/jean|denim/.test(name) && !/shirt/.test(name)) return 'jeans'
  if (/shirt|tee|top|tank|polo|hoodie|jacket|sweat/.test(name)) return 'tshirt'
  if (/lower|pant|trouser|short|jogger|track|cargo|chino|bottom/.test(name)) return 'lowers'
  return 'tshirt'
}

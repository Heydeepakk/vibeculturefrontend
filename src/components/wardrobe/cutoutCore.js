// Pixel work for cutting garments out of their studio background (see cutout.js).
// No DOM here beyond a canvas fallback, so it also runs inside cutout.worker.js.

const makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return c
}

const isBackground = (d, i) => {
  const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]
  if (a < 24) return true
  const min = Math.min(r, g, b), max = Math.max(r, g, b)
  return min > 212 && max - min < 24
}

// Works on an <img> or an ImageBitmap, in a worker or on the page. Returns blobs, not URLs, so the
// result can be posted back from a worker: { cut: false, aspect } or { cut: true, blob, coreBlob, ... }.
export const processImage = async (img) => {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data

  // only cut photos whose border is mostly plain background
  let bg = 0, total = 0
  const border = []
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x)
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1)
  for (const p of border) { total++; if (isBackground(d, p * 4)) bg++ }
  if (bg / total < 0.6) return { cut: false, aspect: w / h }

  const mask = new Uint8Array(w * h)
  const stack = new Int32Array(w * h)
  let sp = 0
  for (const p of border) if (!mask[p] && isBackground(d, p * 4)) { mask[p] = 1; stack[sp++] = p }
  while (sp) {
    const p = stack[--sp]
    const x = p % w
    const n = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]
    for (const q of n) {
      if (q < 0 || q >= w * h || mask[q]) continue
      if (isBackground(d, q * 4)) { mask[q] = 1; stack[sp++] = q }
    }
  }

  let kept = 0, minX = w, minY = h, maxX = 0, maxY = 0
  for (let p = 0; p < w * h; p++) {
    const i = p * 4
    if (mask[p]) { d[i + 3] = 0; continue }
    // soften the light halo along the cut edge
    const x = p % w
    const edge = (x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) || mask[p - w] || mask[p + w]
    if (edge) {
      const light = Math.min(d[i], d[i + 1], d[i + 2])
      if (light > 170) d[i + 3] = Math.max(40, 255 - (light - 170) * 2.4)
    }
    kept++
    const y = (p - x) / w
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  // nearly everything removed means a white garment leaked into the background: keep the photo
  if (kept / (w * h) < 0.08) return { cut: false, aspect: w / h }
  // a garment fills most of its own bounding box; scattered fragments mean the fill ate into it
  if (kept / ((maxX - minX + 1) * (maxY - minY + 1)) < 0.3) return { cut: false, aspect: w / h }

  ctx.putImageData(imageData, 0, 0)
  const cw = maxX - minX + 1, ch = maxY - minY + 1
  const out = makeCanvas(cw, ch)
  const outCtx = out.getContext('2d', { willReadFrequently: true })
  outCtx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch)
  const pixels = outCtx.getImageData(0, 0, cw, ch)

  const coreCanvas = makeCanvas(cw, ch)
  coreCanvas.getContext('2d').putImageData(buildCore(pixels, cw, ch), 0, 0)

  const sides = buildSides(pixels, cw, ch)
  const [blob, coreBlob, leftBlob, rightBlob] = await Promise.all([
    toBlob(out), toBlob(coreCanvas), toBlob(sides.left), toBlob(sides.right),
  ])
  if (!blob) return { cut: false, aspect: w / h }
  return {
    blob, coreBlob, leftBlob, rightBlob,
    outline: sides.outline,
    cut: true,
    aspect: cw / ch,
    waist: topSpan(pixels, cw, ch),
  }
}

// Synthesised side views for when no side photo was uploaded. Each row takes the colour found at the
// garment's left / right edge and wraps it round the side: darker where the fabric turns toward the
// front and back, lighter in the middle, a side seam down the centre and faint vertical drape.
// `outline` samples the garment's real left/right edge at regular heights, so the generated sides follow
// the sleeves, the armpit and the body as one continuous surface.
const SIDE_W = 48
const OUTLINE_POINTS = 30
const buildSides = (img, w, h) => {
  const s = img.data
  const th = Math.min(h, 420)
  const rows = []
  let pl = null, pr = null
  for (let y = 0; y < h; y++) {
    const row = y * w
    let l = -1, r = -1
    for (let x = 0; x < w; x++) if (s[(row + x) * 4 + 3] > 128) { l = x; break }
    if (l < 0) { rows.push(null); continue }
    for (let x = w - 1; x >= l; x--) if (s[(row + x) * 4 + 3] > 128) { r = x; break }
    const k = Math.max(2, Math.round((r - l + 1) * 0.05))
    const avg = (a, b) => {
      let R = 0, G = 0, B = 0, n = 0
      for (let x = a; x <= b; x++) { const i = (row + x) * 4; if (s[i + 3] > 128) { R += s[i]; G += s[i + 1]; B += s[i + 2]; n++ } }
      return n ? [R / n, G / n, B / n] : [128, 128, 128]
    }
    let cl = avg(l, Math.min(r, l + k)), cr = avg(Math.max(l, r - k), r)
    // smooth down the garment so prints touching the edge don't stripe the side
    if (pl) cl = cl.map((c, i) => pl[i] * 0.7 + c * 0.3)
    if (pr) cr = cr.map((c, i) => pr[i] * 0.7 + c * 0.3)
    pl = cl; pr = cr
    rows.push({ l, r, cl, cr })
  }

  const paint = (side) => {
    const c = makeCanvas(SIDE_W, th)
    const ctx = c.getContext('2d')
    const out = ctx.createImageData(SIDE_W, th)
    const d = out.data
    for (let ty = 0; ty < th; ty++) {
      const y = Math.min(h - 1, Math.floor((ty * h) / th))
      const row = rows[y]
      if (!row) continue
      const col = side === 'left' ? row.cl : row.cr
      for (let tx = 0; tx < SIDE_W; tx++) {
        // u: 0 at the back face … 1 at the front face (left texture has the front on its right)
        const u0 = tx / (SIDE_W - 1)
        const u = side === 'left' ? u0 : 1 - u0
        let shade = 0.56 + 0.44 * Math.sin(Math.PI * u) ** 0.7
        shade *= 1 + 0.05 * Math.sin(u * Math.PI * 6 + y * 0.045) + 0.03 * Math.sin(y * 0.29 + u * 9)
        if (Math.abs(u - 0.5) < 0.025) shade *= 0.8 // side seam
        const i = (ty * SIDE_W + tx) * 4
        d[i] = Math.min(255, col[0] * shade); d[i + 1] = Math.min(255, col[1] * shade); d[i + 2] = Math.min(255, col[2] * shade); d[i + 3] = 255
      }
    }
    ctx.putImageData(out, 0, 0)
    return c
  }

  const outline = []
  for (let b = 0; b <= OUTLINE_POINTS; b++) {
    const y = Math.min(h - 1, Math.round((b * (h - 1)) / OUTLINE_POINTS))
    let row = null
    for (let d = 0; d < 4 && !row; d++) row = rows[y - d] || rows[y + d] || null
    outline.push(row ? { y: y / h, l: row.l / w, r: (row.r + 1) / w } : null)
  }
  return { left: paint('left'), right: paint('right'), outline }
}

const toBlob = canvas => (canvas.convertToBlob
  ? canvas.convertToBlob({ type: 'image/png' }).catch(() => null)
  : new Promise(r => canvas.toBlob(r, 'image/png')))

// Silhouette filled, row by row, with the colour found along the garment's left/right edges, slightly darker.
// Seen edge-on, a stack of these reads as the fabric wrapping round the side of the garment.
const buildCore = (img, w, h) => {
  const s = img.data
  const core = new ImageData(w, h)
  const d = core.data
  let pr = -1, pg = 0, pb = 0
  for (let y = 0; y < h; y++) {
    const row = y * w
    let l = -1, r = -1
    for (let x = 0; x < w; x++) if (s[(row + x) * 4 + 3] > 128) { l = x; break }
    if (l < 0) continue
    for (let x = w - 1; x >= l; x--) if (s[(row + x) * 4 + 3] > 128) { r = x; break }
    const k = Math.max(2, Math.round((r - l + 1) * 0.06))
    let R = 0, G = 0, B = 0, n = 0
    for (const [a, b] of [[l, Math.min(r, l + k)], [Math.max(l, r - k), r]]) {
      for (let x = a; x <= b; x++) {
        const i = (row + x) * 4
        if (s[i + 3] > 128) { R += s[i]; G += s[i + 1]; B += s[i + 2]; n++ }
      }
    }
    R /= n; G /= n; B /= n
    // smooth between rows so the side doesn't stripe
    if (pr >= 0) { R = pr * 0.6 + R * 0.4; G = pg * 0.6 + G * 0.4; B = pb * 0.6 + B * 0.4 }
    pr = R; pg = G; pb = B
    for (let x = 0; x < w; x++) {
      const i = (row + x) * 4
      if (!s[i + 3]) continue
      d[i] = R * 0.8; d[i + 1] = G * 0.8; d[i + 2] = B * 0.8; d[i + 3] = s[i + 3]
    }
  }
  return core
}

// Horizontal extent of the top few rows (the waistband for bottoms), as fractions of the width.
const topSpan = (img, w, h) => {
  const s = img.data
  let l = w, r = 0
  for (let y = 0; y < Math.max(2, Math.round(h * 0.04)); y++) {
    for (let x = 0; x < w; x++) {
      if (s[(y * w + x) * 4 + 3] > 128) { if (x < l) l = x; if (x > r) r = x }
    }
  }
  return l <= r ? [l / w, (r + 1) / w] : [0, 1]
}

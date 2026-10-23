import React, { memo, useId, useMemo } from 'react'
import { motion, motionValue, useTransform } from 'framer-motion'
import Hanger from './Hanger'
import ClothFilter from './ClothFilter'
import { useCutout } from './cutout'
import { LITE } from './perf'

// Geometry relative to the garment width W (the hanger SVG is W wide and W/2 tall):
//  top    – where the cloth starts below the hanger's top (collar on the shoulders / waistband in the clips)
//  height – cloth box height
//  depth  – thickness of the garment, seen when it turns sideways
//  taper  – how much thinner (front to back) the hem is than the top: hanging fabric falls together
export const CLOTH = {
  tshirt: { top: 0.205, height: 1.2, depth: 0.095, taper: 0.45 },
  lowers: { top: 0.28, height: 1.45, depth: 0.06, taper: 0.3 },
  jeans: { top: 0.27, height: 1.5, depth: 0.07, taper: 0.25 },
  underwear: { top: 0.24, height: 0.8, depth: 0.045, taper: 0.2 },
}
const HELD_BY_WAIST = { lowers: 0.1, jeans: 0.02, underwear: 0.12 } // clip inset from each waist end
export const garmentHeight = (kind, width) => width * ((CLOTH[kind] || CLOTH.tshirt).top + (CLOTH[kind] || CLOTH.tshirt).height)

// where an image of the given aspect lands inside the box (object-contain, top aligned)
const fitRect = (aspect, W, H) => (aspect > W / H
  ? { x: 0, w: W, h: W / aspect }
  : { x: (W - H * aspect) / 2, w: H * aspect, h: H })

// Generated sides: a chain of strips running from one outline point to the next (down the sleeve, under
// the arm, along the body), each tilted to the outline's slope, textured with the fabric colour wrapped
// round, and clipped to follow the hem taper.
// On phones: half as many strips and fixed shading, since re-filtering dozens of clipped strips every frame
// of a turn is what made the 360 view stutter.
const SIDE_STEP = LITE ? 2 : 1
const AutoSides = ({ res, fit, depth, taper, rotateY }) => {
  const animated = useTransform(rotateY, r => `brightness(${0.78 + 0.22 * Math.abs(Math.sin((r * Math.PI) / 180))})`)
  const filter = LITE ? 'brightness(0.9)' : animated
  const depthAt = y => depth * (1 - (taper * y) / fit.h)
  const pts = res.outline
  const strips = []
  for (let i = 0; i < pts.length - 1; i += SIDE_STEP) {
    const a = pts[i], b = pts[Math.min(i + SIDE_STEP, pts.length - 1)]
    if (!a || !b) continue
    const y0 = a.y * fit.h, y1 = b.y * fit.h
    const dy = Math.max(0.5, y1 - y0)
    for (const side of ['left', 'right']) {
      const x0 = fit.x + (side === 'left' ? a.l : a.r) * fit.w
      const x1 = fit.x + (side === 'left' ? b.l : b.r) * fit.w
      const dx = x1 - x0
      const len = Math.hypot(dx, dy) + 0.8 // overlap a hair so strips don't show seams
      const stretch = len / dy
      // the hem taper: each strip is short, so its average width stands in for a trapezoid
      // (a clip-path inside a 3D scene costs a masked render pass per strip per frame — 10× slower to turn)
      const sw = (depthAt(y0) + depthAt(y1)) / 2
      strips.push(
        <motion.div key={`${side}-${i}`} aria-hidden='true' style={{
          position: 'absolute', top: y0, left: x0 - sw / 2, width: sw, height: len,
          transformOrigin: '50% 0%',
          transform: `rotateZ(${-Math.atan2(dx, dy)}rad) rotateY(${side === 'left' ? -90 : 90}deg)`,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          backgroundImage: `url(${res.sideTex[side]})`,
          backgroundSize: `${sw}px ${fit.h * stretch}px`, backgroundPositionY: -y0 * stretch,
          filter,
        }} />
      )
    }
  }
  return strips
}

// A real side photo (left or right), standing on the garment's edge. Seen from the front it is edge-on and invisible.
const SidePanel = ({ res, side, mirrored, x, top, depth, height, rotateY }) => {
  // brightest when it faces you, a little darker as it turns away
  const animated = useTransform(rotateY, r => `brightness(${0.8 + 0.2 * Math.abs(Math.sin((r * Math.PI) / 180))})`)
  const filter = LITE ? 'brightness(0.9)' : animated
  return (
    <div style={{
      position: 'absolute', left: x - depth / 2, top, width: depth, height,
      transform: `rotateY(${side === 'left' ? -90 : 90}deg)`,
      backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
    }}>
      <motion.img src={res.src} alt='' aria-hidden='true' draggable={false}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ filter, transform: mirrored ? 'scaleX(-1)' : undefined }}
        className={`w-full h-full object-contain object-top select-none ${res.cut ? '' : 'rounded-sm'}`} />
    </div>
  )
}

const STILL = motionValue(0)

const faceStyle = transform => ({
  position: 'absolute', inset: 0, transform, transformOrigin: '50% 0%',
  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
})

const Face = ({ res, back, mirrored, shade, alt, cloth }) => {
  // drop-shadow has to be re-rasterised whenever the filter changes, so phones go without it
  const filter = useTransform(shade, s =>
    `${cloth ? `url(#${cloth}) ` : ''}brightness(${((1 - s) * (mirrored ? 0.9 : 1)).toFixed(3)})${LITE ? '' : ` drop-shadow(0 16px 14px rgba(0,0,0,${res?.cut ? 0.16 : 0.08}))`}`)
  if (!res) return null
  return (
    <motion.img
      key={res.src}
      src={res.src}
      alt={alt}
      draggable={false}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ filter, transform: mirrored ? 'scaleX(-1)' : undefined }}
      className={`w-full h-full object-contain object-top select-none ${res.cut ? '' : 'rounded-md'}`}
    />
  )
}

// A garment on its hanger, built in CSS 3D: rotateY 0 = facing you, 180 = back, ~60 = seen from the side.
// Between the front and back photos sits a stack of "core" layers (the silhouette in the fabric's edge
// colour), so turning it sideways shows real thickness instead of a paper-thin card. When the product has
// real side photos, those stand on the left/right edges and set the thickness instead.
// `drape`, `phase` and `ruffle` (from useClothPhysics) drive the soft-fabric filter on the photos: the hem
// curves with the swing and the cloth ripples and folds, instead of the whole garment moving like card.
const Garment3D = ({ product, kind = 'tshirt', width: W, rotateY, rotateX = 0, flex = 0, drape = flex, phase, ruffle, z = 0, perspective = 1100, showBack = true, layers = 6 }) => {
  const clothId = `cloth-${useId().replace(/:/g, '')}`
  const frontRes = useCutout(product.image?.[0])
  // the back is only fetched once someone can actually turn the garment around
  const backRes = useCutout(showBack ? product.image?.[1] : null)
  // optional real side photos; with only one, it is mirrored for the other side
  const leftRes = useCutout(product.sideImages?.left || null)
  const rightRes = useCutout(product.sideImages?.right || null)
  // light falls off on the faces as the garment turns sideways
  const shade = useTransform(rotateY, r => Math.abs(Math.sin((r * Math.PI) / 180)) * 0.35)

  const geo = CLOTH[kind] || CLOTH.tshirt
  const H = geo.height * W
  const isCut = frontRes?.cut !== false
  // only cut-out photos are fabric; a plain product photo with a background stays flat.
  // The fabric filter (noise, lighting, displacement redrawn every frame) is far too heavy for phones.
  const soft = !LITE && isCut && frontRes ? clothId : null
  const frontFit = frontRes?.aspect ? fitRect(frontRes.aspect, W, H) : { x: 0, w: W, h: H }
  const sideRes = leftRes?.aspect ? leftRes : rightRes?.aspect ? rightRes : null
  // with a side photo, the garment is exactly as thick as the photo shows it
  const depth = sideRes
    ? Math.min(Math.max(frontFit.h * sideRes.aspect, 0.03 * W), 0.55 * W)
    : (isCut ? geo.depth : 0.012) * W
  const coreCount = isCut ? (LITE ? Math.max(2, Math.ceil(layers * 0.6)) : layers) : 2
  // detailed views (pulled out / fitting room) get generated sides when no side photo was uploaded
  const autoSides = !sideRes && isCut && layers > 5 && frontRes?.outline && frontRes?.sideTex
  // faces lean in toward the hem so the garment is thinner at the bottom, matching the side taper
  const taper = sideRes || !isCut ? 0 : geo.taper
  const lean = (Math.atan((depth * taper) / 2 / Math.max(1, frontFit.h)) * 180) / Math.PI

  // clip the trouser hanger onto the actual waistband found in the photo
  const clips = useMemo(() => {
    if (!(kind in HELD_BY_WAIST) || !frontRes?.aspect) return undefined
    const { x, w } = fitRect(frontRes.aspect, W, H)
    const [l, r] = frontRes.waist || [0, 1]
    const inset = (r - l) * w * HELD_BY_WAIST[kind]
    const toBox = px => (px / W) * 200
    return [toBox(x + l * w + inset), toBox(x + r * w - inset)]
  }, [kind, frontRes, W, H])

  const back = backRes || frontRes
  const skewShare = soft ? 0.45 : 1
  const flexSkew = useTransform(typeof flex?.get === 'function' ? flex : STILL, f => f * skewShare)
  const cores = Array.from({ length: coreCount }, (_, i) => {
    const t = coreCount === 1 ? 0 : (i / (coreCount - 1)) * 2 - 1 // -1 (back) … 1 (front)
    // only mix in the back photo when both were cut out the same way, or the side shows a photo edge
    const source = t < 0 && backRes && backRes.cut === frontRes?.cut ? backRes : frontRes
    // fabric bulges a little at mid-depth, so the sides curve rather than look extruded
    const scale = sideRes || autoSides ? 1 : 1 + 0.018 * (1 - t * t)
    return { t, scale, src: source?.core || source?.src, plain: !source?.core }
  })

  return (
    <motion.div className='relative' style={{ width: W, height: garmentHeight(kind, W), rotateY, rotateX, z, transformPerspective: perspective, transformStyle: 'preserve-3d', originY: '5%' }}>
      {/* hanger with a little thickness: two faces and a darker middle */}
      {(layers > 5 ? [-1.6, 0, 1.6] : [0]).map(hz => (
        <Hanger key={hz} kind={kind} clips={clips} className='absolute top-0 left-0 w-full'
          style={{ transform: `translateZ(${hz}px)`, filter: hz === 0 && layers > 5 ? 'brightness(0.72)' : undefined }} />
      ))}

      {soft && <ClothFilter id={soft} width={W} height={H} flex={drape} phase={phase} ruffle={ruffle} />}

      {/* the cloth hangs from the hanger and bends: `flex` skews it a little from the top and the filter curves
          the hem the rest of the way, so it trails like fabric rather than tilting like a board */}
      <motion.div className='absolute left-0 w-full' style={{ top: geo.top * W, height: H, transformStyle: 'preserve-3d', skewX: flexSkew, originY: '0%' }}>
        {frontRes && cores.map(c => (
          <img key={c.t} src={c.src} alt='' aria-hidden='true' draggable={false}
            className={`absolute inset-0 w-full h-full object-contain object-top select-none ${c.plain ? 'rounded-md' : ''}`}
            style={{
              transform: `translateZ(${(c.t * depth) / 2}px) rotateX(${-lean * c.t}deg) scale(${c.scale})`, transformOrigin: '50% 0%',
              filter: c.plain ? 'brightness(0.7)' : undefined,
            }} />
        ))}
        {autoSides && <AutoSides res={frontRes} fit={frontFit} depth={depth} taper={taper} rotateY={rotateY} />}
        {frontRes && sideRes && (
          <>
            <SidePanel res={leftRes?.aspect ? leftRes : rightRes} side='left' mirrored={!leftRes?.aspect}
              x={frontFit.x} top={0} depth={depth} height={frontFit.h} rotateY={rotateY} />
            <SidePanel res={rightRes?.aspect ? rightRes : leftRes} side='right' mirrored={!rightRes?.aspect}
              x={frontFit.x + frontFit.w} top={0} depth={depth} height={frontFit.h} rotateY={rotateY} />
          </>
        )}
        <div style={faceStyle(`translateZ(${depth / 2 + 0.5}px) rotateX(${-lean}deg)`)}>
          <Face res={frontRes} shade={shade} alt={product.name} cloth={soft} />
        </div>
        {/* a packed garment on a phone never turns far enough to show its back: one layer fewer each */}
        {(!LITE || showBack) && (
          <div style={faceStyle(`rotateY(180deg) translateZ(${depth / 2 + 0.5}px) rotateX(${-lean}deg)`)}>
            <Face res={back} mirrored={!backRes} shade={shade} alt={`${product.name} back`} cloth={soft} />
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// memo: pulling one garment out re-renders every slot on the rail, but only that one garment changes
export default memo(Garment3D)

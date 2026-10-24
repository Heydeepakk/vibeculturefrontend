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
  tshirt:    { top: 0.18,  height: 1.2,  depth: 0.095, taper: 0.45 },
  lowers:    { top: 0.26,  height: 1.45, depth: 0.06,  taper: 0.3  },
  jeans:     { top: 0.25,  height: 1.5,  depth: 0.07,  taper: 0.25 },
  underwear: { top: 0.22,  height: 0.8,  depth: 0.045, taper: 0.2  },
}
const HELD_BY_WAIST = { lowers: 0.1, jeans: 0.02, underwear: 0.12 } // clip inset from each waist end
// clothTop ≈ W * 0.85/2 * 0.28 ≈ 0.12 * W
export const garmentHeight = (kind, width) => width * (0.12 + (CLOTH[kind] || CLOTH.tshirt).height)

// where an image of the given aspect lands inside the box (object-contain, top aligned)
const fitRect = (aspect, W, H) => (aspect > W / H
  ? { x: 0, w: W, h: W / aspect }
  : { x: (W - H * aspect) / 2, w: H * aspect, h: H })

// Generated sides: a chain of strips running from one outline point to the next (down the sleeve, under
// the arm, along the body), each tilted to the outline's slope, textured with the fabric colour wrapped
// round, and clipped to follow the hem taper.
// On phones: half as many strips and fixed shading, since re-filtering dozens of clipped strips every frame
// of a turn is what made the 360 view stutter.
// SVG side panel: draws the garment's real silhouette outline as a filled curved shape.
// Much more accurate than folded CSS strips — follows sleeve taper, armpit curve, body width.
const AutoSides = ({ res, fit, depth, taper, rotateY }) => {
  const pts = res.outline
  if (!pts?.length) return null

  // visibility: brightest at 90deg (facing you), dark at 0/180 (edge-on)
  const opacity = useTransform(rotateY, r => Math.abs(Math.sin((r * Math.PI) / 180)))
  const brightness = useTransform(rotateY, r => 0.65 + 0.35 * Math.abs(Math.sin((r * Math.PI) / 180)))
  const filter = LITE ? undefined : useTransform(brightness, b => `brightness(${b.toFixed(3)})`)

  const depthAt = y => depth * (1 - (taper * y) / fit.h)

  // build left and right SVG paths from the outline
  const W = fit.x + fit.w + depth
  const H = fit.h

  // left side: outline goes down the left edge, offset inward by depth
  const leftPts = pts.filter(Boolean)
  const rightPts = pts.filter(Boolean)

  const leftPath = leftPts.length < 2 ? '' : (() => {
    const outer = leftPts.map(p => [fit.x + p.l * fit.w, p.y * fit.h])
    const inner = leftPts.map(p => [fit.x + p.l * fit.w + depthAt(p.y * fit.h), p.y * fit.h])
    const d = `M ${outer[0][0]} ${outer[0][1]} ` +
      outer.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ') +
      ` L ${inner[inner.length - 1][0]} ${inner[inner.length - 1][1]} ` +
      inner.slice(0, -1).reverse().map(([x, y]) => `L ${x} ${y}`).join(' ') + ' Z'
    return d
  })()

  const rightPath = rightPts.length < 2 ? '' : (() => {
    const outer = rightPts.map(p => [fit.x + p.r * fit.w, p.y * fit.h])
    const inner = rightPts.map(p => [fit.x + p.r * fit.w - depthAt(p.y * fit.h), p.y * fit.h])
    const d = `M ${outer[0][0]} ${outer[0][1]} ` +
      outer.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ') +
      ` L ${inner[inner.length - 1][0]} ${inner[inner.length - 1][1]} ` +
      inner.slice(0, -1).reverse().map(([x, y]) => `L ${x} ${y}`).join(' ') + ' Z'
    return d
  })()

  // sample edge colours from the side texture
  const leftCol = res.sideTex?.left ? `url(#stl-${res.aspect?.toFixed(3)})` : '#888'
  const rightCol = res.sideTex?.right ? `url(#str-${res.aspect?.toFixed(3)})` : '#888'
  const uid = res.aspect?.toFixed(3) || '0'

  return (
    <motion.svg
      aria-hidden='true'
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', opacity, filter }}
    >
      <defs>
        <pattern id={`stl-${uid}`} patternUnits='userSpaceOnUse' width={depth} height={fit.h}>
          <image href={res.sideTex.left} x='0' y='0' width={depth} height={fit.h} preserveAspectRatio='none' />
        </pattern>
        <pattern id={`str-${uid}`} patternUnits='userSpaceOnUse' width={depth} height={fit.h}>
          <image href={res.sideTex.right} x='0' y='0' width={depth} height={fit.h} preserveAspectRatio='none' />
        </pattern>
      </defs>
      {leftPath && <path d={leftPath} fill={`url(#stl-${uid})`} />}
      {rightPath && <path d={rightPath} fill={`url(#str-${uid})`} />}
    </motion.svg>
  )
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
    : (isCut ? geo.depth : geo.depth * 0.6) * W
  const coreCount = isCut ? (LITE ? Math.max(2, Math.ceil(layers * 0.6)) : layers) : 2
  // show generated sides whenever we have outline data, not just on detailed views
  const autoSides = !sideRes && isCut && frontRes?.outline && frontRes?.sideTex
  // faces lean in toward the hem so the garment is thinner at the bottom, matching the side taper
  const taper = sideRes || !isCut ? 0 : geo.taper
  const lean = (Math.atan((depth * taper) / 2 / Math.max(1, frontFit.h)) * 180) / Math.PI

  // clip the trouser hanger onto the actual waistband found in the photo
  // hanger SVG is frontFit.w wide (viewBox 0-200), map pixel positions relative to frontFit.w
  const clips = useMemo(() => {
    if (!(kind in HELD_BY_WAIST) || !frontRes?.aspect) return undefined
    const { x, w } = fitRect(frontRes.aspect, W, H)
    const [l, r] = frontRes.waist || [0, 1]
    const inset = (r - l) * w * HELD_BY_WAIST[kind]
    const toBox = px => ((px - x) / w) * 200
    return [toBox(x + l * w + inset), toBox(x + r * w - inset)]
  }, [kind, frontRes, W, H])

  const back = backRes || frontRes
  const skewShare = soft ? 0.45 : 1
  // hem trails the swing: small skewX on the cloth div gives the lower half a lag
  // but keep it subtle — the main swing is handled by rotate on the outer wrapper in ClosetSlot
  const flexSkew = useTransform(typeof flex?.get === 'function' ? flex : STILL, f => f * (soft ? 0.3 : 0.5))
  const cores = Array.from({ length: coreCount }, (_, i) => {
    const t = coreCount === 1 ? 0 : (i / (coreCount - 1)) * 2 - 1 // -1 (back) … 1 (front)
    // only mix in the back photo when both were cut out the same way, or the side shows a photo edge
    const source = t < 0 && backRes && backRes.cut === frontRes?.cut ? backRes : frontRes
    // fabric bulges a little at mid-depth, so the sides curve rather than look extruded
    const scale = sideRes || autoSides ? 1 : 1 + 0.018 * (1 - t * t)
    return { t, scale, src: source?.core || source?.src, plain: !source?.core }
  })

  // Hanger geometry:
  // The SuitBody shoulder span is x≈15–185 = 170/200 = 85% of viewBox width.
  // A shirt's shoulder seams sit at ~72% of the image width.
  // So hanger width = frontFit.w * (0.72 / 0.85) ≈ frontFit.w * 0.85, centred on the image.
  const hangerW = frontFit.w * 0.85
  const hangerH = hangerW / 2                        // viewBox is 200×100
  const hangerLeft = frontFit.x + (frontFit.w - hangerW) / 2
  // The shirt collar (neckline) sits at y≈40/100 of the hanger height.
  // The shirt image top starts at the collar, so clothTop = hangerH * 0.40.
  // We push the shirt up by 30% of that so the collar overlaps the hanger shoulders naturally.
  const clothTop = hangerH * 0.28

  return (
    <motion.div className='relative' style={{ width: W, height: clothTop + H + 8, rotateY, rotateX, z, transformPerspective: perspective, transformStyle: 'preserve-3d', originY: '5%' }}>

      {/* hanger sits behind the shirt, shoulders hidden under the fabric */}
      {(layers > 5 ? [-1.6, 0, 1.6] : [0]).map(hz => (
        <Hanger key={hz} kind={kind} clips={clips} className='absolute'
          style={{
            left: hangerLeft,
            top: 0,
            width: hangerW,
            height: hangerH,
            transform: `translateZ(${hz}px)`,
            filter: hz === 0 && layers > 5 ? 'brightness(0.72)' : undefined,
          }} />
      ))}

      {soft && <ClothFilter id={soft} width={W} height={H} flex={drape} phase={phase} ruffle={ruffle} />}

      {/* cloth hangs from the collar point, overlapping the hanger shoulders */}
      <motion.div className='absolute left-0 w-full' style={{ top: clothTop, height: H, transformStyle: 'preserve-3d', skewX: flexSkew, originY: '0%' }}>
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

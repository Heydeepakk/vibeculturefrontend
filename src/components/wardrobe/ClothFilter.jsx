import React, { useEffect, useMemo, useRef } from 'react'

// An SVG filter that makes a flat garment photo read as soft, hanging fabric:
//  folds  – long vertical folds lit from the side, shading the print like real drape
//  ripple – the cloth is pushed about by a slowly morphing noise, nothing at the collar, most at the hem
//  bend   – the hem curves away from the shoulders (a curve, not a straight skew) as the garment swings
// Everything is static except a handful of numbers, which are written straight onto the filter each frame.

// drawn at the garment's real size, so there are no steps in the gradient to show up as jagged edges
const gradient = (stops, w, h) => {
  const s = stops.map(([o, v]) => `<stop offset='${o}' stop-color='rgb(${v.map(c => Math.round(c * 255)).join(',')})'/>`).join('')
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>${s}</linearGradient></defs><rect width='${w}' height='${h}' fill='url(#g)'/></svg>`)}`
}
// how free the fabric is at each height: held at collar, fully loose at hem
const free = y => Math.min(1, Math.max(0, (y - 0.04) / 0.96)) ** 1.2
const YS = Array.from({ length: 21 }, (_, i) => i / 20)
const weightMap = (w, h) => gradient(YS.map(y => [y, [free(y), free(y), free(y)]]), w, h)
// red = sideways shift for the bend (0.5 = none), green 0.5 = no vertical shift
const bendMap = (w, h) => gradient(YS.map(y => [y, [0.5 + 0.5 * free(y) ** 1.3, 0.5, 0.5]]), w, h)

const read = v => (typeof v?.get === 'function' ? v.get() : v || 0)

const ClothFilter = ({ id, width: W, height: H, flex, phase, ruffle, folds = 0.55 }) => {
  const mix = useRef(null)
  const wave = useRef(null)
  const bend = useRef(null)
  const shade = useRef(null)

  useEffect(() => {
    const draw = () => {
      const f = read(flex)
      const r = read(ruffle)
      const p = read(phase)
      const a = 0.5 + 0.5 * Math.sin(p)
      mix.current?.setAttribute('k2', a.toFixed(3))
      mix.current?.setAttribute('k3', (1 - a).toFixed(3))
      wave.current?.setAttribute('scale', (W * (0.06 + 0.15 * r)).toFixed(2))
      bend.current?.setAttribute('scale', (-2.5 * H * Math.tan((f * Math.PI) / 180) * 0.5).toFixed(2))
      const s = folds + 0.12 * Math.min(1, r)
      shade.current?.setAttribute('k1', s.toFixed(3))
      shade.current?.setAttribute('k2', (1 - s).toFixed(3))
    }
    draw()
    const off = [flex, phase, ruffle].filter(v => typeof v?.on === 'function').map(v => v.on('change', draw))
    return () => off.forEach(u => u())
  }, [flex, phase, ruffle, W, H, folds])

  // folds run lengthwise: a few across the width, long down the body
  const freq = useMemo(() => `${(3 / W).toFixed(5)} ${(0.55 / H).toFixed(5)}`, [W, H])
  // the maps cover the whole filter area: anywhere they don't, the photo would be pulled out of place
  const mw = Math.round(W * 1.4), mh = Math.round(H)
  const maps = useMemo(() => ({ weight: weightMap(mw, mh), bend: bendMap(mw, mh) }), [mw, mh])

  return (
    <svg width='0' height='0' aria-hidden='true' style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <filter id={id} filterUnits='userSpaceOnUse' x={-W * 0.2} y='0' width={mw} height={mh} colorInterpolationFilters='sRGB'>
        <feTurbulence type='fractalNoise' baseFrequency={freq} numOctaves='2' seed='3' result='n1raw' />
        <feTurbulence type='fractalNoise' baseFrequency={freq} numOctaves='2' seed='11' result='n2raw' />
        <feColorMatrix in='n1raw' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1' result='n1' />
        <feColorMatrix in='n2raw' values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1' result='n2' />

        {/* folds: the noise as a height map, lit from the upper left, multiplied into the photo */}
        <feGaussianBlur in='n1raw' stdDeviation={(W * 0.02).toFixed(2)} result='soft' />
        <feDiffuseLighting in='soft' surfaceScale={(W * 0.14).toFixed(2)} diffuseConstant='1.18' lightingColor='#fff' result='lightRaw'>
          <feDistantLight azimuth='215' elevation='58' />
        </feDiffuseLighting>
        <feGaussianBlur in='lightRaw' stdDeviation={(W * 0.012).toFixed(2)} result='light' />
        <feComposite ref={shade} in='SourceGraphic' in2='light' operator='arithmetic' k1={folds} k2={1 - folds} k3='0' k4='0' result='shaded' />

        {/* ripple: two noises cross-fading so the cloth keeps changing shape, weighted toward the hem */}
        <feComposite ref={mix} in='n1' in2='n2' operator='arithmetic' k1='0' k2='0.5' k3='0.5' k4='0' result='noise' />
        <feImage href={maps.weight} x={-W * 0.2} y='0' width={mw} height={mh} preserveAspectRatio='none' result='weight' />
        <feComposite in='noise' in2='weight' operator='arithmetic' k1='1' k2='0' k3='-0.5' k4='0.5' result='rippleRaw' />
        {/* browsers dither gradients; smooth the maps so that grain isn't magnified into ragged edges */}
        <feGaussianBlur in='rippleRaw' stdDeviation='2.5' result='rippleMap' />
        <feImage href={maps.bend} x={-W * 0.2} y='0' width={mw} height={mh} preserveAspectRatio='none' result='bendRaw' />
        <feGaussianBlur in='bendRaw' stdDeviation='2.5' result='bendMap' />

        <feDisplacementMap ref={bend} in='shaded' in2='bendMap' scale='0' xChannelSelector='R' yChannelSelector='G' result='bent' />
        <feDisplacementMap ref={wave} in='bent' in2='rippleMap' scale={W * 0.035} xChannelSelector='R' yChannelSelector='G' />
      </filter>
    </svg>
  )
}

export default ClothFilter

import React, { useId } from 'react'

// Hangers share one geometry: viewBox 200x100, hook curl centred at (99, 10) where the rail rod passes.
// tshirt    = contoured wooden suit hanger (the collar sits at y≈41)
// lowers    = wooden trouser bar with two chrome spring clips (waistband gripped at y≈56)
// jeans     = matte black clamp hanger gripping the whole waistband (y≈54)
// underwear = small black plastic retail hanger with mini clips (y≈48)
// `clips` = x positions (viewBox units) of the waistband ends, for the clip/clamp hangers
const HOOK = 'M100 34 L100 30 C100 22 108 20 108 12 C108 5 103 2 99 2 C94 2 91 6 91 10'

const Hanger = ({ kind = 'tshirt', clips = [52, 148], className = '', style }) => {
  const uid = useId().replace(/:/g, '')
  const wood = `url(#wood-${uid})`
  const chrome = `url(#chrome-${uid})`
  const chromeH = `url(#chromeh-${uid})`

  return (
    <svg viewBox='0 0 200 100' className={className} style={style} aria-hidden='true'>
      <defs>
        <linearGradient id={`wood-${uid}`} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor='#dcae76' />
          <stop offset='40%' stopColor='#b98447' />
          <stop offset='100%' stopColor='#7a4e26' />
        </linearGradient>
        <linearGradient id={`chrome-${uid}`} x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stopColor='#fbfbfb' />
          <stop offset='40%' stopColor='#a9a9a9' />
          <stop offset='70%' stopColor='#e6e6e6' />
          <stop offset='100%' stopColor='#8a8a8a' />
        </linearGradient>
        <linearGradient id={`chromeh-${uid}`} x1='0' y1='0' x2='1' y2='0'>
          <stop offset='0%' stopColor='#7d7d7d' />
          <stop offset='35%' stopColor='#f5f5f5' />
          <stop offset='65%' stopColor='#bdbdbd' />
          <stop offset='100%' stopColor='#6f6f6f' />
        </linearGradient>
      </defs>

      {/* hook: dark core, body, specular line (black plastic on the underwear hanger) */}
      <path d={HOOK} fill='none' stroke={kind === 'underwear' ? '#000' : '#5c5c5c'} strokeWidth={kind === 'underwear' ? 4 : 4.6} strokeLinecap='round' />
      <path d={HOOK} fill='none' stroke={kind === 'underwear' ? '#262626' : chrome} strokeWidth={kind === 'underwear' ? 3 : 3.4} strokeLinecap='round' />
      <path d={HOOK} fill='none' stroke={kind === 'underwear' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)'} strokeWidth='0.9' strokeLinecap='round' transform='translate(-0.7 -0.5)' />

      {kind === 'lowers' && <ClipBar clips={clips} wood={wood} chromeH={chromeH} />}
      {kind === 'jeans' && <ClampBar clips={clips} />}
      {kind === 'underwear' && <MiniClips clips={clips} />}
      {kind === 'tshirt' && <SuitBody wood={wood} />}

      {/* ferrule where the hook enters the hanger */}
      {kind !== 'underwear' && (
        <>
          <rect x='95.5' y={kind === 'tshirt' ? 33 : 27} width='9' height='8' rx='2' fill={chromeH} />
          <rect x='95.5' y={kind === 'tshirt' ? 36 : 30} width='9' height='1.2' fill='rgba(0,0,0,0.25)' />
        </>
      )}
    </svg>
  )
}

// drawn full width, then narrowed so the shoulder tips stay hidden inside a shirt's shoulders
const SuitBody = ({ wood }) => (
  <g transform='translate(100 40) scale(0.78 0.9) translate(-100 -40)'>
    {/* trouser bar between the shoulder tips */}
    <path d='M18 84 L18 89' stroke='#6d4421' strokeWidth='3' strokeLinecap='round' />
    <path d='M182 84 L182 89' stroke='#6d4421' strokeWidth='3' strokeLinecap='round' />
    <rect x='16' y='87.5' width='168' height='4' rx='2' fill={wood} />
    <rect x='16' y='87.5' width='168' height='1.2' rx='0.6' fill='rgba(255,255,255,0.3)' />

    {/* contoured shoulders */}
    <path
      d='M100 40 C78 41 46 55 16 72 C8 76 7 84 15 85 C42 80 72 68 100 67 C128 68 158 80 185 85 C193 84 192 76 184 72 C154 55 122 41 100 40 Z'
      fill={wood} />
    {/* grain */}
    <g fill='none' stroke='#5a3716' strokeOpacity='0.18' strokeWidth='0.8'>
      <path d='M28 72 C54 58 80 49 100 47 C120 49 146 58 172 72' />
      <path d='M22 78 C50 66 78 57 100 55 C122 57 150 66 178 78' />
      <path d='M60 66 C76 60 90 61 100 61 C110 61 124 60 140 66' />
    </g>
    {/* light on the top edge, shade underneath */}
    <path d='M100 41.3 C78 42.3 47 56 18 72.6' fill='none' stroke='rgba(255,255,255,0.5)' strokeWidth='1.3' strokeLinecap='round' />
    <path d='M100 41.3 C122 42.3 153 56 182 72.6' fill='none' stroke='rgba(255,255,255,0.35)' strokeWidth='1.3' strokeLinecap='round' />
    <path d='M15 85 C42 80 72 68 100 67 C128 68 158 80 185 85' fill='none' stroke='rgba(40,20,5,0.35)' strokeWidth='1.2' />
    {/* shoulder notches for straps */}
    <path d='M37 60.5 l4 -2.6 l1.6 3.4 z' fill='#5a3716' opacity='0.7' />
    <path d='M163 60.5 l-4 -2.6 l-1.6 3.4 z' fill='#5a3716' opacity='0.7' />
  </g>
)

const ClipBar = ({ clips, wood, chromeH }) => {
  const left = Math.max(10, Math.min(...clips) - 16)
  const right = Math.min(190, Math.max(...clips) + 16)
  return (
    <g>
      {/* wooden bar */}
      <rect x={left} y='35' width={right - left} height='10' rx='5' fill={wood} />
      <rect x={left + 3} y='36.2' width={right - left - 6} height='2' rx='1' fill='rgba(255,255,255,0.4)' />
      <path d={`M${left + 5} 44.6 H${right - 5}`} stroke='rgba(40,20,5,0.35)' strokeWidth='1' />

      {clips.map(cx => (
        <g key={cx}>
          {/* hanging link */}
          <rect x={cx - 1.2} y='44' width='2.4' height='7' fill={chromeH} />
          {/* spring clip: back jaw, front jaw, rivet, rubber grip */}
          <path d={`M${cx - 8} 51 h16 v11 q0 2 -2 2 h-12 q-2 0 -2 -2 z`} fill='#8d8d8d' />
          <path d={`M${cx - 8.5} 50 h17 q1 0 1 1 v4 q0 1.5 -1.5 1.5 h-16 q-1.5 0 -1.5 -1.5 v-4 q0 -1 1 -1 z`} fill={chromeH} />
          <path d={`M${cx - 7.5} 56.5 h15 l-0.6 6 q-0.2 1.5 -1.8 1.5 h-10.2 q-1.6 0 -1.8 -1.5 z`} fill={chromeH} />
          <circle cx={cx} cy='53' r='1.5' fill='#4d4d4d' />
          <rect x={cx - 7} y='63' width='14' height='2.2' rx='1' fill='#1f1f1f' />
          <path d={`M${cx - 7} 51 h4`} stroke='rgba(255,255,255,0.8)' strokeWidth='0.8' />
        </g>
      ))}
    </g>
  )
}

const span = (clips, margin, min = 10, max = 190) => [Math.max(min, Math.min(...clips) - margin), Math.min(max, Math.max(...clips) + margin)]

// felt-lined clamp across the whole waistband
const ClampBar = ({ clips }) => {
  const [left, right] = span(clips, 8, 14, 186)
  const w = right - left
  return (
    <g>
      <rect x={left} y='34' width={w} height='9' rx='3' fill='#1d1d1d' />
      <rect x={left + 2} y='35' width={w - 4} height='1.6' rx='0.8' fill='rgba(255,255,255,0.18)' />
      {/* back jaw, front jaw, felt grip */}
      <rect x={left + 1} y='43' width={w - 2} height='15' rx='2' fill='#2a2a2a' />
      <path d={`M${left} 44 h${w} v13 q0 2.5 -2.5 2.5 h${-(w - 5)} q-2.5 0 -2.5 -2.5 z`} fill='#333' />
      <rect x={left + 1} y='44.5' width={w - 2} height='1.2' fill='rgba(255,255,255,0.15)' />
      <rect x={left + 1.5} y='57' width={w - 3} height='2.6' rx='1' fill='#111' />
      {/* release lever */}
      <rect x='92' y='45' width='16' height='5' rx='2.5' fill='#444' />
      <rect x='93' y='45.6' width='14' height='1' rx='0.5' fill='rgba(255,255,255,0.25)' />
    </g>
  )
}

// small black plastic retail hanger with two mini clips
const MiniClips = ({ clips }) => {
  const [left, right] = span(clips, 6, 24, 176)
  return (
    <g>
      <path d='M100 32 L100 37' stroke='#1d1d1d' strokeWidth='4' />
      <rect x={left} y='35' width={right - left} height='6' rx='3' fill='#1d1d1d' />
      <rect x={left + 2} y='35.8' width={right - left - 4} height='1.2' rx='0.6' fill='rgba(255,255,255,0.2)' />
      {clips.map(cx => (
        <g key={cx}>
          <rect x={cx - 1.5} y='40' width='3' height='4' fill='#1d1d1d' />
          <path d={`M${cx - 6} 43 h12 v8 q0 2 -2 2 h-8 q-2 0 -2 -2 z`} fill='#262626' />
          <rect x={cx - 5} y='44' width='10' height='1' fill='rgba(255,255,255,0.22)' />
          <rect x={cx - 5} y='52' width='10' height='1.6' rx='0.8' fill='#000' />
        </g>
      ))}
    </g>
  )
}

export default Hanger

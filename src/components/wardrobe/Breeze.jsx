import React from 'react'

// Soft "air" streaks and drifting lint that float across the wardrobe background.
const STREAKS = [
  { top: '18%', width: 260, delay: 0, duration: 9 },
  { top: '34%', width: 180, delay: 3.5, duration: 11 },
  { top: '52%', width: 320, delay: 1.5, duration: 13 },
  { top: '68%', width: 220, delay: 6, duration: 10 },
  { top: '82%', width: 160, delay: 8, duration: 12 },
]

const LINT = Array.from({ length: 0 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${15 + ((i * 53) % 70)}%`,
  size: 2 + (i % 3),
  delay: (i * 0.9) % 7,
  duration: 9 + (i % 5) * 2,
}))

const Breeze = () => (
  <div className='absolute inset-0 overflow-hidden pointer-events-none' aria-hidden='true'>
    {STREAKS.map((s, i) => (
      <span key={i} className='breeze-streak'
        style={{ top: s.top, width: s.width, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }} />
    ))}
    {LINT.map((p, i) => (
      <span key={i} className='breeze-lint'
        style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }} />
    ))}
  </div>
)

export default Breeze

import { useCallback, useRef } from 'react'
import { useAnimationFrame, useMotionValue, useReducedMotion } from 'framer-motion'
import { cutoutsBusy } from './cutout'
import { overlayOpen } from './perf'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// A breeze that always blows the same way and comes in gusts, with still spells in between (0 … ~1.1).
export const breeze = (t) => {
  const g = 0.55 * Math.sin(t * 0.31) + 0.3 * Math.sin(t * 0.83 + 1.3) + 0.15 * Math.sin(t * 2.1 + 0.4)
  return Math.max(0, g - 0.1) ** 1.4
}
// fast, small turbulence on top of the gusts
const flutter = (t) => 0.5 * Math.sin(t * 5.3) + 0.5 * Math.sin(t * 8.7 + 1.1)

// Per-garment cloth simulation, run every frame without re-rendering React.
//  swing – pendulum angle round the hook (deg): pushed by the breeze, thrown by the rail's acceleration
//          (a hard push or sudden stop makes clothes fly) and held back by air drag while it moves
//  twist – the hanger turning a little on its hook (deg)
//  flex  – the hem trailing the shoulders, with its own quicker wobble (deg of skew)
//  phase – fabric clock for the ripples running through the cloth; runs faster in a gust or a swing
//  ruffle – how hard the fabric is moving right now (0 … ~1.2): ripple depth and fold contrast
// `kick(degPerSecond)` gives it a push (pointer brushing past, a neighbour bumping into it).
const NO_MOTION = { v: 0, a: 0 }
const RAD = Math.PI / 180

// `railSample(delaySeconds)` returns the rail's { v, a } (px/s, px/s²) a moment ago; each garment reads
// it a little later than its neighbour, so a shove travels down the rail like real hangers knocking on.
// `visibleRef` (optional) lets the caller switch one garment off while it is off screen.
// `foreground` keeps it running while the fitting room covers the page (everything else pauses).
const useClothPhysics = ({ index = 0, railSample, enabled = true, calm = false, strength = 1, visibleRef, foreground = false } = {}) => {
  const reduce = useReducedMotion()
  const swing = useMotionValue(0)
  const twist = useMotionValue(0)
  const flex = useMotionValue(0)
  const phase = useMotionValue(index * 1.7)
  const ruffle = useMotionValue(0)
  const s = useRef({ a: 0, w: 0, tw: 0, tv: 0, f: 0, fv: 0, ph: index * 1.7, r: 0, asleep: false })
  const live = useRef({ enabled, calm, strength, foreground })
  live.current = { enabled, calm, strength, foreground }

  // each garment has its own length/weight, so they never move in lockstep
  const k = 13 + (index % 5) * 1.7
  const c = 1.05 + (index % 3) * 0.3
  const lag = index * 0.18 // gusts reach garments further down the rail a moment later
  const hand = index % 2 ? 1 : -1

  useAnimationFrame((time, delta) => {
    const { enabled: on, calm: still, strength: power, foreground: front } = live.current
    if (reduce || !on || cutoutsBusy() || (visibleRef && !visibleRef.current) || (!front && overlayOpen())) return
    const dt = Math.min(delta, 48) / 1000
    const t = time / 1000 - lag
    const st = s.current
    const air = breeze(t) * power * (still ? 0.3 : 1)
    const m = railSample ? railSample(index * 0.014) : NO_MOTION
    const v = clamp(m.v, -5000, 5000)
    const acc = clamp(m.a, -40000, 40000)

    // a real pendulum on a moving support: gravity pulls it back (sin, so big swings feel weighty),
    // the support's acceleration throws it (cos), air drag grows with the square of the speed
    const force = air * 20 + flutter(t * 0.7 + index) * 2.2 * air
      - acc * 0.05 * Math.cos(st.a * RAD)
      - (v * 0.012 + v * Math.abs(v) * 0.000006)
    st.w += (-k * Math.sin(st.a * RAD) / RAD - c * st.w + force) * dt
    st.a += st.w * dt
    if (Math.abs(st.a) > 58) { st.a = Math.sign(st.a) * 58; st.w *= -0.3 } // knocks the rail and bounces back

    // the hanger turns slightly on its hook as gusts come and go
    const torque = (air - 0.35) * 26 * hand
    st.tv += (-6 * st.tw - 1.5 * st.tv + torque) * dt
    st.tw += st.tv * dt

    // fabric: the hem trails the swing and ripples in the gusts
    const target = clamp(-st.w * 0.22, -9, 9) + flutter(t * 1.3 + index * 2) * 0.9 * air
    st.fv += ((target - st.f) * 60 - st.fv * 9) * dt
    st.f += st.fv * dt

    // soft fabric never stops moving at once: the ripple eases in with a gust or a swing and fades slowly
    const stir = clamp(air * 0.85 + Math.abs(st.w) * 0.012 + Math.abs(st.fv) * 0.01, 0, 1.2)
    st.r += (stir - st.r) * Math.min(1, dt * (stir > st.r ? 4 : 1.2))
    st.ph += dt * (0.35 + st.r * 2.2)

    // settled and no wind: stop touching the page until something moves it again
    const resting = air < 0.02 && Math.abs(v) < 5 && Math.abs(acc) < 50 &&
      Math.abs(st.a) + Math.abs(st.w) + Math.abs(st.tw) + Math.abs(st.tv) + Math.abs(st.f) + Math.abs(st.fv) + st.r < 0.08
    if (resting && st.asleep) return
    st.asleep = resting

    swing.set(st.a)
    twist.set(clamp(st.tw, -12, 12))
    flex.set(clamp(st.f, -10, 10))
    phase.set(st.ph)
    ruffle.set(st.r)
  })

  const kick = useCallback((impulse) => {
    if (!reduce) { s.current.w += impulse; s.current.asleep = false }
  }, [reduce])

  return { swing, twist, flex, phase, ruffle, kick }
}

export default useClothPhysics

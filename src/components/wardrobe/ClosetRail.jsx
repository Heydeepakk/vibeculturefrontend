import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, animate, useAnimationFrame, useMotionValue, useMotionValueEvent, useSpring, useTransform, useVelocity } from 'framer-motion'
import { toast } from 'react-toastify'
import { ShopContext } from '../../context/ShopContext'
import Garment3D, { garmentHeight } from './Garment3D'
import useClothPhysics from './useClothPhysics'
import { buzz } from './haptics'

const SLOT = 0.3     // spacing between packed garments, × garment width
const SPREAD = 0.45  // how far neighbours slide aside when one is pulled out
const PULL = 0.38    // how far the pulled garment comes toward you
const PULL_SCALE = 1.1 // it looks this much bigger once pulled out (perspective), so the caption sits lower

export const railMetrics = (count, gw, pad = gw * 0.7) => {
  const slotW = gw * SLOT
  const spread = gw * SPREAD
  return { slotW, spread, pad, width: pad * 2 + spread * 2 + count * slotW }
}

const ClosetSlot = ({ product, index, state, flipped, gw, slotW, spread, left, height, railSample, inView, railId, currency, touch, handlers }) => {
  const active = state === 'active'
  const [seen, setSeen] = useState(false) // once pulled out, keep the back image loaded
  useEffect(() => { if (active) setSeen(true) }, [active])
  const idleAngle = 62 + ((index * 37) % 9) - 4
  const targetRot = active ? (flipped ? 180 : 0) : idleAngle
  const turn = useSpring(idleAngle, { stiffness: 120, damping: 17 })
  const z = useSpring(0, { stiffness: 160, damping: 20 })
  useEffect(() => { turn.set(targetRot) }, [targetRot, turn])
  useEffect(() => { z.set(active ? gw * PULL : 0) }, [active, gw, z])

  // breeze, rail drag, bumps: a real pendulum per garment (calmer while held out)
  const cloth = useClothPhysics({ index, railSample, enabled: inView, calm: active })
  // Changing a garment's 3D shape every frame is costly with ~20 on screen, so on the packed rail the hem lag
  // and twist are drawn as cheap 2D skew / width change of the flattened garment; the pulled-out one gets them in 3D.
  const activeRef = useRef(active)
  activeRef.current = active
  const rotateY = useTransform([turn, cloth.twist], ([r, t]) => r + (activeRef.current ? t * 0.3 : 0))
  const railSkew = useTransform(cloth.flex, f => (activeRef.current ? 0 : f * 0.8))
  const railTwist = useTransform(cloth.twist, t => (activeRef.current ? 1
    : Math.cos(((idleAngle + t) * Math.PI) / 180) / Math.cos((idleAngle * Math.PI) / 180)))
  useEffect(() => handlers.register(index, cloth.kick), [index, cloth.kick, handlers])

  // pulled toward you, the hem lags behind and swings back
  const tilt = useMotionValue(0)
  useEffect(() => {
    if (active) animate(tilt, [0, 9, -5, 2.5, -1, 0], { duration: 1.6, ease: 'easeOut' })
  }, [active, tilt])

  const shift = state === 'left' ? -spread : state === 'right' ? spread : 0

  return (
    <div className='absolute top-0' style={{ left, width: slotW, height, zIndex: active ? 500 : index + 1 }}>
      {/* the garment itself (visual only on desktop; the slot below is the hover target) */}
      <motion.div
        className='absolute top-0'
        style={{ left: slotW / 2 - gw / 2, width: gw, pointerEvents: active && touch ? 'auto' : 'none' }}
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0, x: shift }}
        transition={{ x: { type: 'spring', stiffness: 170, damping: 22 }, default: { type: 'spring', stiffness: 120, damping: 12, delay: Math.min(index, 14) * 0.035 } }}
        onClick={() => handlers.open(product)}
      >
        <motion.div style={{ rotate: cloth.swing, skewX: railSkew, scaleX: railTwist, transformOrigin: '50% 5%' }}>
          <Garment3D product={product} kind={product._kind} width={gw} rotateY={rotateY} rotateX={tilt} flex={active ? cloth.flex : 0}
            z={z} showBack={seen} layers={active ? 9 : 3} />
        </motion.div>
      </motion.div>

      {/* hit box: narrow and fixed, so sweeping the pointer riffles through the rail */}
      <button
        type='button'
        aria-label={`${product.name}, ${currency}${product.price}`}
        className='absolute inset-0 focus:outline-none'
        onPointerDown={handlers.pointerDown}
        onPointerEnter={e => {
          if (e.pointerType !== 'mouse') return
          // brushing past pushes the garment the way the pointer was moving; while dragging the rail, only push
          const r = e.currentTarget.getBoundingClientRect()
          if (e.buttons & 1) { handlers.brush(index, e.clientX < r.left + r.width / 2 ? 1 : -1); return }
          handlers.brush(index, e.clientX < r.left + r.width / 2 ? 1 : -1)
          handlers.hover(index)
        }}
        onPointerLeave={e => e.pointerType === 'mouse' && handlers.unhover(index)}
        onFocus={e => e.target.matches(':focus-visible') && handlers.activate(index)}
        onClick={() => handlers.tap(index, product)}
      />

      <AnimatePresence>
        {active && (
          <PulledCaption key='caption' product={product} currency={currency} flipped={flipped} touch={touch} handlers={handlers}
            style={{ top: height * PULL_SCALE + 8, left: slotW / 2 - Math.max(gw * 1.25, 230) / 2, width: Math.max(gw * 1.25, 230) }} />
        )}
      </AnimatePresence>
    </div>
  )
}

// Name, price, Front/Back, and a quick "add to bag" with sizes, under the pulled-out garment.
const PulledCaption = ({ product, currency, flipped, touch, handlers, style }) => {
  const { products, addToCart } = useContext(ShopContext)
  const full = products.find(p => p._id === product._id) || product
  const legacyVariants = full.variants?.length > 0 // old attribute products: choose options in the fitting room
  const sizes = legacyVariants ? [] : (full.sizes || [])
  const [size, setSize] = useState('')
  const [added, setAdded] = useState(false)

  const add = () => {
    if (legacyVariants || (sizes.length && !size)) {
      if (sizes.length && !size) toast.info('Pick a size first')
      else handlers.open(product)
      return
    }
    addToCart(full._id, sizes.length ? size : '0')
    buzz(12)
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
    toast.success(`${full.name}${size ? ` (${size})` : ''} added to bag`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
      transition={{ delay: 0.12 }}
      className='absolute flex flex-col items-center text-center'
      style={style}
    >
      <p className='text-[13px] text-gray-900 font-medium leading-snug line-clamp-1 w-full'>{product.name}</p>
      <div className='flex items-center gap-2 mt-1'>
        <span className='font-serif text-base font-bold text-gray-900'>{currency}{product.price}</span>
        {product.bestseller && <span className='accent-badge text-[8px] font-black px-2 py-0.5 rounded-full tracking-wider uppercase'>Bestseller</span>}
        {product.inStock === false && <span className='text-[8px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase bg-white border border-gray-200 text-gray-500'>Sold out</span>}
      </div>
      {sizes.length > 0 && (
        <div className='flex flex-wrap justify-center gap-1 mt-2'>
          {sizes.map(sz => (
            <button key={sz} type='button' onClick={() => setSize(sz)}
              className={`min-w-[30px] px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors ${size === sz ? 'bg-gray-900 text-white border-gray-900' : 'bg-white/90 text-gray-600 border-gray-200 hover:border-gray-500'}`}>
              {sz}
            </button>
          ))}
        </div>
      )}
      <div className='flex items-center gap-1.5 mt-2'>
        <div className='flex bg-white/90 border border-gray-200 rounded-full p-0.5 shadow-sm'>
          {['Front', 'Back'].map((label, i) => (
            <button key={label} type='button' onClick={() => handlers.flip(i === 1)}
              className={`px-2.5 py-1 rounded-full text-[9px] tracking-[0.15em] uppercase font-semibold transition-colors ${flipped === (i === 1) ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              {label}
            </button>
          ))}
        </div>
        {product.inStock !== false && (
          <motion.button type='button' onClick={add} whileTap={{ scale: 0.92 }}
            className={`px-3 py-1.5 rounded-full text-[9px] tracking-[0.15em] uppercase font-semibold shadow-sm transition-colors ${added ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-black'}`}>
            {added ? '✓ Added' : '+ Bag'}
          </motion.button>
        )}
        <button type='button' onClick={() => handlers.open(product)}
          className='px-3 py-1.5 rounded-full text-[9px] tracking-[0.15em] uppercase font-semibold bg-white/90 border border-gray-200 text-gray-700 hover:border-gray-900 shadow-sm'>
          {touch ? 'View' : 'Try it'} →
        </button>
      </div>
    </motion.div>
  )
}

// A packed closet rail: garments hang side-on; hover (or tap) pulls one out to face you.
const ClosetRail = ({ products, gw, position, invert = false, railId, currency, onOpen, style, trackRef }) => {
  const [activeIndex, setActiveIndex] = useState(-1)
  const [flipped, setFlipped] = useState(false)
  const [touch, setTouch] = useState(false)
  const touchRef = useRef(false) // read synchronously in the click that follows pointerdown
  const hoverTimer = useRef(null)
  const leaveTimer = useRef(null)
  const activatedAt = useRef(0)
  const activeIndexRef = useRef(-1)
  activeIndexRef.current = activeIndex

  const { slotW, spread, pad, width } = railMetrics(products.length, gw)
  const height = Math.max(...products.map(p => garmentHeight(p._kind || 'tshirt', gw)), garmentHeight('tshirt', gw))

  const kicks = useRef([])
  const bump = useCallback((i, impulse, spread = 2) => {
    // a push travels to the neighbours, weaker each step, like hangers knocking together
    kicks.current[i]?.(impulse)
    for (let d = 1; d <= spread; d++) {
      const fade = 0.4 ** d
      setTimeout(() => { kicks.current[i - d]?.(impulse * fade); kicks.current[i + d]?.(impulse * fade) }, d * 90)
    }
  }, [])

  const activate = useCallback((i) => {
    clearTimeout(leaveTimer.current)
    setActiveIndex(prev => {
      if (prev !== i) {
        // neighbours get shoved aside as the garment comes out
        kicks.current[i - 1]?.(-30); kicks.current[i + 1]?.(30)
        if (touchRef.current) buzz(6)
      }
      return i
    })
    setFlipped(false)
    activatedAt.current = position?.get() ?? 0
  }, [position])

  // the rail's speed drives the air drag on every garment
  const rawVelocity = useVelocity(position)
  const railVelocity = useTransform(rawVelocity, v => (invert ? -v : v))

  // moving the rail far enough puts the pulled garment back
  useMotionValueEvent(position, 'change', v => {
    if (activeIndex >= 0 && Math.abs(v - activatedAt.current) > gw * 0.9) setActiveIndex(-1)
  })

  // only simulate while the rail is on screen
  const ownRef = useRef(null)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ownRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const setRefs = el => {
    ownRef.current = el
    if (typeof trackRef === 'function') trackRef(el); else if (trackRef) trackRef.current = el
  }

  // keep ~1s of the rail's speed and (smoothed) acceleration, so each garment can feel the shove a little later
  const motionLog = useRef({ hist: [], v: 0, a: 0, t: 0 })
  useAnimationFrame((time) => {
    if (!inView) return
    const log = motionLog.current
    const now = time / 1000
    const v = railVelocity.get()
    const dt = log.t ? Math.max(0.008, now - log.t) : 0.016
    log.a += ((v - log.v) / dt - log.a) * 0.35
    log.v = v; log.t = now
    log.hist.push({ t: now, v, a: log.a })
    while (log.hist.length && now - log.hist[0].t > 1.2) log.hist.shift()
  })
  const railSample = useCallback((delay) => {
    const h = motionLog.current.hist
    if (!h.length) return { v: 0, a: 0 }
    const target = h[h.length - 1].t - delay
    for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= target) return h[i]
    return h[0]
  }, [])

  useEffect(() => { setActiveIndex(-1) }, [products])
  useEffect(() => () => { clearTimeout(hoverTimer.current); clearTimeout(leaveTimer.current) }, [])

  const handlers = useMemo(() => ({
    pointerDown: e => { touchRef.current = e.pointerType !== 'mouse'; setTouch(touchRef.current) },
    hover: i => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => activate(i), 70) },
    unhover: () => clearTimeout(hoverTimer.current),
    brush: (i, dir) => bump(i, -26 * dir, 1),
    register: (i, kick) => { kicks.current[i] = kick; return () => { if (kicks.current[i] === kick) kicks.current[i] = null } },
    activate,
    tap: (i, product) => {
      if (touchRef.current && i !== activeIndexRef.current) activate(i)
      else onOpen(product)
    },
    flip: v => setFlipped(v),
    open: p => onOpen(p),
  }), [activate, bump, onOpen])

  const stateOf = i => (activeIndex < 0 ? 'idle' : i === activeIndex ? 'active' : i < activeIndex ? 'left' : 'right')

  return (
    <motion.div
      ref={setRefs}
      style={{ ...style, width, height: height * PULL_SCALE + 150 }}
      className='relative flex-shrink-0'
      onPointerLeave={e => {
        if (e.pointerType !== 'mouse') return
        clearTimeout(hoverTimer.current)
        leaveTimer.current = setTimeout(() => setActiveIndex(-1), 350)
      }}
      onPointerEnter={() => clearTimeout(leaveTimer.current)}
      onClick={e => { if (e.target === e.currentTarget) setActiveIndex(-1) }}
    >
      <div className='wardrobe-rod absolute left-0 right-0' style={{ top: gw * 0.05 - 4 }} />
      <span className='wardrobe-bracket left-2' style={{ height: gw * 0.05 + 10 }} />
      <span className='wardrobe-bracket right-2' style={{ height: gw * 0.05 + 10 }} />
      {products.map((p, i) => (
        <ClosetSlot key={`${railId}-${p._id}`} product={p} index={i} state={stateOf(i)} flipped={flipped}
          gw={gw} slotW={slotW} spread={spread} left={pad + spread + i * slotW} height={height}
          railSample={railSample} inView={inView} railId={railId} currency={currency} touch={touch} handlers={handlers} />
      ))}
    </motion.div>
  )
}

export default ClosetRail

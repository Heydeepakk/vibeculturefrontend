import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion'
import useClothPhysics from './useClothPhysics'
import { LITE } from './perf'

// One letter hanging from its word's little rail on a string and a clip, swinging in the same breeze as the clothes.
const HangingLetter = ({ char, index, bold, visibleRef }) => {
  const cloth = useClothPhysics({ index: index * 3 + 1, strength: 1.4, visibleRef })
  const stringLen = 10 + ((index * 37) % 5) * 4
  return (
    <motion.span
      className='inline-flex flex-col items-center cursor-grab select-none'
      // own layer, so swinging moves the letter on the GPU instead of repainting the glyph every frame
      style={{ rotate: cloth.swing, transformOrigin: '50% 0%', willChange: 'transform' }}
      initial={{ y: -160, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 140, damping: 9, delay: 0.15 + index * 0.06 }}
      onPointerEnter={e => cloth.kick(e.movementX >= 0 ? -70 : 70)}
      onTapStart={() => cloth.kick(index % 2 ? 60 : -60)}
    >
      <span className='w-px bg-gray-400' style={{ height: stringLen }} />
      <span className='w-2.5 h-2 rounded-[2px] bg-gray-800 -mt-px' />
      <span className={`leading-[0.9] ${bold ? 'font-bold italic text-gray-900' : 'font-light text-gray-900'}`}>{char}</span>
    </motion.span>
  )
}

const RACK_WORDS = ['T-Shirts', 'Lowers', 'Jeans', 'Underwear']
const PERKS = ['Turn every piece round before you buy', '240 GSM cotton terry', 'Free delivery over ₹299', '7-day easy returns', 'Fresh drops every week', 'Secure payments']

// Home page opening: hanging-letter headline, a rotating line, rack shortcuts, a perks ticker and a scroll cue.
const HeroHeadline = ({ racks }) => {
  const [word, setWord] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setWord(w => (w + 1) % RACK_WORDS.length), 2200)
    return () => clearInterval(t)
  }, [])

  // letters stop swinging once the headline is scrolled away
  const rootRef = useRef(null)
  const visible = useRef(true)
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // soft spotlight that follows the pointer (desktop only: there is no hovering pointer on a phone)
  const mx = useSpring(useMotionValue(50), { stiffness: 60, damping: 20 })
  const my = useSpring(useMotionValue(30), { stiffness: 60, damping: 20 })
  const spotlight = useMotionTemplate`radial-gradient(600px circle at ${mx}% ${my}%, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)`
  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect()
    mx.set(((e.clientX - r.left) / r.width) * 100)
    my.set(((e.clientY - r.top) / r.height) * 100)
  }

  const words = [{ text: 'Pick' }, { text: 'it' }, { text: 'off' }, { text: 'the', bold: true }, { text: 'rack', bold: true }]
  let n = 0

  return (
    <div ref={rootRef} className='relative overflow-hidden' onPointerMove={LITE ? undefined : onMove}>
      {!LITE && <motion.div className='absolute inset-0 pointer-events-none' style={{ background: spotlight }} />}

      <div className='relative px-6 sm:px-10 pt-10 sm:pt-14 pb-6 max-w-7xl mx-auto'>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className='text-[10px] sm:text-xs tracking-[0.35em] uppercase text-gray-500 mb-4 flex items-center gap-3'>
          <span className='inline-block w-8 h-px bg-gray-400' /> The VibeCulture Wardrobe
        </motion.p>

        <h1 aria-label='Pick it off the rack' className='font-serif text-[52px] sm:text-7xl lg:text-8xl flex flex-wrap gap-x-5 sm:gap-x-8 gap-y-2'>
          {words.map((w, wi) => (
            <span key={wi} aria-hidden='true' className='relative inline-flex pt-1'>
              {/* each word's own little rail */}
              <motion.span className='wardrobe-rod absolute -left-2 -right-2 top-0 !h-1.5'
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: wi * 0.08 }} style={{ originX: 0 }} />
              {[...w.text].map(ch => <HangingLetter key={n} char={ch} index={n++} bold={w.bold} visibleRef={visible} />)}
            </span>
          ))}
        </h1>

        <div className='mt-6 flex items-center gap-2 text-base sm:text-xl text-gray-600 font-light h-8 overflow-hidden' style={{ perspective: 400 }}>
          <span>Straight off the rail:</span>
          <span className='relative inline-flex h-full'>
            <AnimatePresence mode='popLayout' initial={false}>
              <motion.span key={word} className='font-semibold text-gray-900 whitespace-nowrap'
                initial={{ y: 28, opacity: 0, rotateX: -80 }} animate={{ y: 0, opacity: 1, rotateX: 0 }} exit={{ y: -28, opacity: 0, rotateX: 80 }}
                transition={{ type: 'spring', stiffness: 220, damping: 22 }}>
                {RACK_WORDS[word]}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
        <p className='text-sm text-gray-500 mt-2 max-w-md'>Hover a piece to pull it out (tap on your phone), then turn it round to see every side.</p>

        <div className='flex flex-wrap gap-2 mt-7'>
          {racks.map((r, i) => (
            <motion.a key={r.kind} href={`#rack-${r.kind}`}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 + i * 0.08 }}
              whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }}
              className='px-4 py-2.5 rounded-full text-[11px] tracking-[0.2em] uppercase bg-white/80 border border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-900 shadow-sm transition-colors'>
              {r.title} <span className='text-gray-400 ml-1'>{r.products.length}</span>
            </motion.a>
          ))}
        </div>

        <motion.a href={racks[0] ? `#rack-${racks[0].kind}` : undefined}
          className='hidden sm:flex absolute right-10 bottom-8 flex-col items-center gap-1 text-[10px] tracking-[0.3em] uppercase text-gray-500'
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
          <motion.svg viewBox='0 0 40 30' className='w-10' animate={{ y: [0, 6, 0], rotate: [-6, 6, -6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} style={{ originY: 0 }}>
            <path d='M20 10 V7 C20 4 23 3.5 23 1.8 C23 0.6 21.8 0 20.6 0' fill='none' stroke='#888' strokeWidth='1.4' strokeLinecap='round' />
            <path d='M20 10 C14 10 6 15 2 20 C1 21 2 22 3 22 L37 22 C38 22 39 21 38 20 C34 15 26 10 20 10 Z' fill='#b98447' />
          </motion.svg>
          Scroll the rack
        </motion.a>
      </div>

      {/* perks ticker */}
      <div className='relative border-y border-gray-200/80 bg-white/40 overflow-hidden py-3'>
        <div className='marquee-track flex w-max gap-10 whitespace-nowrap text-[11px] tracking-[0.25em] uppercase text-gray-600'>
          {[...PERKS, ...PERKS].map((p, i) => (
            <span key={i} className='flex items-center gap-10'>{p}<span className='text-[#b98447]'>✦</span></span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HeroHeadline

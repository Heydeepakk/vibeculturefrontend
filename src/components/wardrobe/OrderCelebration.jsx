import React, { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import Hanger from './Hanger'

const COLORS = ['#111111', '#e8c96d', '#c89a63', '#9a9a9a', '#f5f2ed', '#7a4e26']

// Shown once after a successful payment: confetti, and an empty hanger swinging — its garment is on the way.
const OrderCelebration = ({ onDone }) => {
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.4 + Math.random() * 1.8,
    drift: (Math.random() - 0.5) * 220,
    spin: (Math.random() - 0.5) * 900,
    size: 6 + Math.random() * 8,
    color: COLORS[i % COLORS.length],
    round: i % 3 === 0,
  })), [])

  useEffect(() => {
    const t = setTimeout(onDone, 5200)
    return () => clearTimeout(t)
  }, [onDone])

  return createPortal(
    <motion.div className='fixed inset-0 z-[80] flex items-center justify-center px-6 bg-[#f5f2ed]/80 backdrop-blur-sm'
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onDone}>
      {pieces.map((p, i) => (
        <motion.span key={i} className='absolute top-0 pointer-events-none'
          style={{ left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 0.45, background: p.color, borderRadius: p.round ? '50%' : 2 }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', x: p.drift, rotate: p.spin, opacity: [1, 1, 0.8] }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }} />
      ))}

      <motion.div className='relative bg-white rounded-3xl shadow-2xl px-8 py-8 text-center max-w-sm w-full'
        initial={{ y: 40, scale: 0.9 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}>
        <motion.div className='w-28 mx-auto' style={{ transformOrigin: '50% 5%' }}
          animate={{ rotate: [0, 14, -10, 6, -3, 1, 0] }} transition={{ duration: 2.4, delay: 0.4 }}>
          <Hanger kind='tshirt' className='w-full' />
        </motion.div>
        <h2 className='font-serif text-2xl font-semibold text-gray-900 mt-2'>Order placed!</h2>
        <p className='text-sm text-gray-500 mt-2'>Your pieces are off the rack and being packed. You can follow every step below.</p>
        <button onClick={onDone} className='mt-6 w-full py-3 rounded-full bg-gray-900 text-white text-xs tracking-[0.25em] uppercase font-semibold'>
          Track my order
        </button>
      </motion.div>
    </motion.div>,
    document.body
  )
}

export default OrderCelebration

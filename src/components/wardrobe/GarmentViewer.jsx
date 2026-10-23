import React, { forwardRef, useEffect, useRef, useState } from 'react'
import { motion, animate, useMotionValue, useMotionValueEvent, useTransform } from 'framer-motion'
import Garment3D from './Garment3D'
import useClothPhysics from './useClothPhysics'

// A single garment on a short rail that you can drag round, with Front / Back buttons.
// The forwarded ref points at the stage (used for the "fly to bag" animation).
const GarmentViewer = forwardRef(({ product, kind = 'tshirt', className = 'w-[min(70%,320px)]', layers = 14 }, ref) => {
  const rotateY = useMotionValue(70)
  const dragFrom = useRef(0)
  const stageRef = useRef(null)
  const [stageW, setStageW] = useState(0)
  const [showBack, setShowBack] = useState(false)
  const hasBack = (product.image || []).length > 1
  // same breeze as the rack, a little gentler indoors
  const cloth = useClothPhysics({ index: 3, strength: 0.6 })
  const shown = useTransform([rotateY, cloth.twist], ([r, t]) => r + t * 0.5)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setStageW(e.contentRect.width))
    stageRef.current && ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [])

  // comes off the rail sideways and turns to face you
  useEffect(() => {
    rotateY.set(70)
    animate(rotateY, 0, { type: 'spring', stiffness: 70, damping: 12 })
  }, [product._id, rotateY])

  useMotionValueEvent(rotateY, 'change', r => {
    const back = Math.cos((r * Math.PI) / 180) < 0
    if (back !== showBack) setShowBack(back)
  })

  // snap to the nearest face (front or back) after a drag
  const settle = (target) => {
    const r = rotateY.get()
    const to = target === undefined ? Math.round(r / 180) * 180 : Math.round((r - target) / 360) * 360 + target
    animate(rotateY, to, { type: 'spring', stiffness: 90, damping: 14 })
  }

  const setRefs = el => {
    stageRef.current = el
    if (typeof ref === 'function') ref(el); else if (ref) ref.current = el
  }

  return (
    <div className='select-none'>
      <motion.div
        ref={setRefs}
        className={`relative mx-auto cursor-grab active:cursor-grabbing touch-pan-y ${className}`}
        onPanStart={() => { dragFrom.current = rotateY.get() }}
        onPan={(e, info) => rotateY.set(dragFrom.current + info.offset.x * 0.6)}
        onPanEnd={(e, info) => { cloth.kick(Math.max(-60, Math.min(60, info.velocity.x * 0.04))); settle() }}
      >
        {stageW > 0 && <div className='wardrobe-rod absolute -left-[60%] -right-[60%]' style={{ top: stageW * 0.05 - 4 }} />}
        <motion.div style={{ rotate: cloth.swing, transformOrigin: '50% 5%' }}>
          {stageW > 0 && <Garment3D product={product} kind={kind} width={stageW} rotateY={shown} flex={cloth.flex} phase={cloth.phase} ruffle={cloth.ruffle} perspective={1400} layers={layers} />}
        </motion.div>
      </motion.div>
      <div className='flex flex-col items-center gap-2 mt-4'>
        <div className='flex bg-white border border-gray-200 rounded-full p-1 shadow-sm'>
          {[{ label: 'Front', deg: 0 }, { label: 'Back', deg: 180 }].map(({ label, deg }) => (
            <button key={label} type='button' onClick={() => settle(deg)}
              className={`px-4 py-1.5 rounded-full text-[10px] tracking-[0.2em] uppercase font-semibold transition-colors ${showBack === (deg === 180) ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className='text-[10px] tracking-[0.25em] uppercase text-gray-400'>
          Drag to turn{!hasBack && ' · back view not photographed'}
        </p>
      </div>
    </div>
  )
})

GarmentViewer.displayName = 'GarmentViewer'

export default GarmentViewer

import React, { useContext, useRef, useState } from 'react'
import { AnimatePresence, useScroll } from 'framer-motion'
import { ShopContext } from '../../context/ShopContext'
import ClosetRail from './ClosetRail'
import FittingRoom from './FittingRoom'
import useGarmentWidth from './useGarmentWidth'

const garmentWidth = (vw) => Math.max(140, Math.min(vw * 0.42, 230))

// A free-scrolling closet rail (swipe, trackpad, drag or arrows) for one category.
const HangerRail = ({ products, railId }) => {
  const { currency } = useContext(ShopContext)
  const [selected, setSelected] = useState(null)
  const scrollerRef = useRef(null)
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: 0 })
  const gw = useGarmentWidth(garmentWidth)
  const { scrollX } = useScroll({ container: scrollerRef })

  const scrollBy = dir => {
    const el = scrollerRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' })
  }

  const onPointerDown = e => {
    if (e.pointerType !== 'mouse') return
    drag.current = { active: true, startX: e.clientX, startScroll: scrollerRef.current.scrollLeft, moved: 0 }
  }
  const onPointerMove = e => {
    const d = drag.current
    if (!d.active || !(e.buttons & 1)) { d.active = false; return }
    d.moved = Math.abs(e.clientX - d.startX)
    scrollerRef.current.scrollLeft = d.startScroll - (e.clientX - d.startX)
  }
  const endDrag = () => { drag.current.active = false }

  return (
    <div className='relative group/rail'>
      <div ref={scrollerRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag}
        onClickCapture={e => { if (drag.current.moved > 6) { e.stopPropagation(); drag.current.moved = 0 } }}
        className='relative overflow-x-auto overflow-y-hidden scrollbar-hide pt-1 pb-2 cursor-grab active:cursor-grabbing'>
        <ClosetRail products={products} gw={gw} position={scrollX} invert railId={railId}
          currency={currency} onOpen={setSelected} />
      </div>

      {[-1, 1].map(dir => (
        <button key={dir} onClick={() => scrollBy(dir)} aria-label={dir < 0 ? 'Scroll left' : 'Scroll right'}
          className={`hidden sm:flex absolute top-[30%] ${dir < 0 ? 'left-2' : 'right-2'} z-[600] w-11 h-11 rounded-full bg-white/90 border border-gray-200 shadow-md items-center justify-center text-gray-700 hover:bg-gray-900 hover:text-white transition-all opacity-0 group-hover/rail:opacity-100`}>
          {dir < 0 ? '←' : '→'}
        </button>
      ))}

      <AnimatePresence>
        {selected && <FittingRoom key={selected._id} item={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  )
}

export default HangerRail

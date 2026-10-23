import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { ShopContext } from '../../context/ShopContext'
import ClosetRail, { railMetrics } from './ClosetRail'
import Breeze from './Breeze'
import HeroHeadline from './HeroHeadline'
import FittingRoom from './FittingRoom'
import useGarmentWidth from './useGarmentWidth'
import { garmentKind, RACKS } from './cutout'
import { getRecentlyViewed } from './journey'

const NAV_OFFSET = 80
// garment width follows the screen height so a pulled-out garment plus its caption fits the pinned view
const garmentWidth = (vw, vh) => Math.max(140, Math.min(vh * 0.28, vw * 0.48, 290))

// Group products into the four racks (T-shirts, lowers, jeans, underwear) by their category's hanger.
export const groupIntoRacks = (categoryRacks) => {
  const byKind = Object.fromEntries(Object.keys(RACKS).map(k => [k, []]))
  categoryRacks.forEach(r => {
    const kind = garmentKind(r.category)
    r.products.forEach(p => byKind[kind].push({ ...p, _kind: kind }))
  })
  return Object.entries(byKind)
    .filter(([, products]) => products.length)
    .map(([kind, products]) => ({ kind, ...RACKS[kind], products: products.sort((a, b) => (b.date || 0) - (a.date || 0)) }))
}

// same shape as /api/product/racks, built from the already-loaded product list
const groupByCategory = (products) => {
  const map = new Map()
  products.forEach(p => {
    const cat = typeof p.category === 'object' && p.category ? p.category : null
    if (!cat) return
    if (!map.has(cat._id)) map.set(cat._id, { category: cat, products: [] })
    map.get(cat._id).products.push(p)
  })
  return Array.from(map.values())
}

// Home page wardrobe: one rack per hanger type.
const WardrobeShowcase = ({ limit = 40 }) => {
  const { products, backendUrl } = useContext(ShopContext)
  const [categoryRacks, setCategoryRacks] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    axios.get(`${backendUrl}/api/product/racks?limit=${limit}`)
      .then(r => r.data.success && setCategoryRacks(r.data.racks))
      .catch(() => {})
  }, [backendUrl, limit])

  const racks = useMemo(
    () => groupIntoRacks(categoryRacks?.length ? categoryRacks : groupByCategory(products)),
    [categoryRacks, products])

  // a personal rack first: what this visitor picked up last time
  const recent = useMemo(() => getRecentlyViewed()
    .map(id => products.find(p => p._id === id))
    .filter(p => p && typeof p.category === 'object' && p.category)
    .map(p => ({ ...p, _kind: garmentKind(p.category) })), [products])

  if (!racks.length) return <div className='min-h-[60vh] bg-[#f5f2ed]' />

  return (
    <div className='bg-[#f5f2ed]'>
      <HeroHeadline racks={racks} />

      {recent.length > 0 && (
        <RackSection rack={{ kind: 'recent', title: 'Picked up recently', note: 'Welcome back', products: recent }} index={-1} onOpen={setSelected} />
      )}
      {racks.map((rack, i) => (
        <RackSection key={rack.kind} rack={rack} index={i} onOpen={setSelected} />
      ))}

      <AnimatePresence>
        {selected && <FittingRoom key={selected._id} item={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  )
}

// One rack. When it is wider than the screen, the section pins and the page scroll slides the rail sideways.
const RackSection = ({ rack, index, onOpen }) => {
  const { currency } = useContext(ShopContext)
  const [distance, setDistance] = useState(0)
  const sectionRef = useRef(null)
  const viewportRef = useRef(null)
  const gw = useGarmentWidth(garmentWidth)

  const railWidth = railMetrics(rack.products.length, gw).width
  useLayoutEffect(() => {
    const measure = () => viewportRef.current && setDistance(Math.max(0, railWidth - viewportRef.current.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    viewportRef.current && ro.observe(viewportRef.current)
    return () => ro.disconnect()
  }, [railWidth])

  const pinned = distance > 0
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] })
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })
  const scrolledX = useTransform(smoothProgress, p => -p * distance)
  const still = useMotionValue(0)
  const x = pinned ? scrolledX : still
  const progressWidth = useTransform(smoothProgress, p => `${p * 100}%`)

  return (
    <section id={`rack-${rack.kind}`} ref={sectionRef} className='relative scroll-mt-20'
      style={{ height: pinned ? `calc(100vh + ${distance}px)` : undefined }}>
      <div className={`${pinned ? 'sticky top-0 h-screen supports-[height:100svh]:h-[100svh]' : 'py-10'} overflow-hidden flex flex-col`}
        style={{ paddingTop: pinned ? NAV_OFFSET : undefined }}>
        <Breeze />

        <div className='relative z-10 px-6 sm:px-10 pt-4 sm:pt-8 max-w-7xl w-full mx-auto flex items-end justify-between gap-4'>
          <div>
            <p className='text-[10px] sm:text-xs tracking-[0.35em] uppercase text-gray-500 mb-2'>
              {index >= 0 && `${String(index + 1).padStart(2, '0')} · `}{rack.note}
            </p>
            <h2 className='font-serif text-3xl sm:text-5xl font-light text-gray-900 leading-none'>{rack.title}</h2>
          </div>
          {RACKS[rack.kind] && <Link to={`/collection?rack=${rack.kind}`}
            className='text-[10px] tracking-[0.3em] uppercase font-semibold text-gray-900 border-b border-gray-900 pb-0.5 whitespace-nowrap hover:opacity-60 transition-opacity'>
            View all {rack.products.length}
          </Link>}
        </div>

        <div ref={viewportRef} className={`relative z-10 ${pinned ? 'flex-1 min-h-0' : ''} mt-4 sm:mt-6 flex flex-col justify-center`}>
          <div className='absolute inset-x-0 top-[12%] bottom-[18%] bg-gradient-to-b from-black/[0.035] via-transparent to-transparent pointer-events-none' />
          <ClosetRail products={rack.products} gw={gw} position={x} railId={`home-${rack.kind}`} currency={currency}
            onOpen={onOpen} style={{ x }} />
        </div>

        {pinned && (
          <div className='relative z-10 px-6 sm:px-10 pb-6 sm:pb-8 max-w-7xl w-full mx-auto flex items-center gap-6'>
            <div className='flex-1 h-px bg-gray-300 relative overflow-hidden'>
              <motion.div className='absolute inset-y-0 left-0 bg-gray-900' style={{ width: progressWidth }} />
            </div>
            <p className='text-[10px] tracking-[0.3em] uppercase text-gray-500 whitespace-nowrap'>Scroll to browse →</p>
          </div>
        )}
      </div>
    </section>
  )
}

export default WardrobeShowcase

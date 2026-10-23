import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ShopContext } from '../../context/ShopContext'
import GarmentViewer from './GarmentViewer'
import FreeDeliveryBar from './FreeDeliveryBar'
import { rememberViewed } from './journey'
import { buzz } from './haptics'
import { getCutout } from './cutout'
import { LITE, pushOverlay } from './perf'

// The fitting room: the garment comes off the rail, turns to face you and can be spun to see the back.
const FittingRoom = ({ item, onClose }) => {
  const { products, currency, addToCart } = useContext(ShopContext)
  const product = useMemo(() => products.find(p => p._id === item._id) || item, [products, item])
  const variants = product.variants || []
  const [selected, setSelected] = useState({})
  const [size, setSize] = useState('')
  const sizes = variants.length ? [] : (product.sizes || [])
  const [flyer, setFlyer] = useState(null)
  const [added, setAdded] = useState(false)
  const stageRef = useRef(null)
  const kind = item._kind || 'tshirt'

  const attributeOptions = useMemo(() => {
    const map = {}
    variants.forEach(v => v.attributes.forEach(a => {
      if (!map[a.attributeName]) map[a.attributeName] = new Set()
      map[a.attributeName].add(a.variantValue)
    }))
    return Object.keys(map).map(name => ({ name, values: Array.from(map[name]) }))
  }, [variants])

  const selectedVariant = attributeOptions.length && attributeOptions.every(a => selected[a.name])
    ? variants.find(v => v.attributes.every(a => selected[a.attributeName] === a.variantValue)) || null
    : null

  const price = selectedVariant?.price ?? product.price
  const description = String(product.description || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

  useEffect(() => { rememberViewed(product._id) }, [product._id])
  // the racks behind stop animating while this is open
  useEffect(() => pushOverlay(), [])

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prevOverflow; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const handleAdd = () => {
    if (variants.length) {
      if (!selectedVariant) { toast.error('Please select all options'); return }
      if (selectedVariant.quantity === 0) { toast.error('Out of stock'); return }
      addToCart(product._id, variants.indexOf(selectedVariant).toString())
    } else if (sizes.length) {
      if (!size) { toast.error('Please choose a size'); return }
      addToCart(product._id, size)
    } else {
      addToCart(product._id, '0')
    }

    // the garment flies into the bag (top-right cart icon)
    const rect = stageRef.current?.getBoundingClientRect()
    if (rect) getCutout(product.image?.[0]).then(c => c && setFlyer({ src: c.src, rect }))
    buzz(12)
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
    toast.success(`${product.name} added to bag`)
  }

  const isOptionAvailable = (name, value) => variants.some(v =>
    v.quantity > 0 && v.attributes.every(a => a.attributeName === name ? a.variantValue === value : (!selected[a.attributeName] || selected[a.attributeName] === a.variantValue))
  )

  return createPortal(
    <>
      {/* a live blur of the page behind costs a full-screen re-blur per frame on phones */}
      <motion.div className={`fixed inset-0 z-[60] ${LITE ? 'bg-black/50' : 'bg-black/40 backdrop-blur-sm'}`}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />

      <div className='fixed inset-0 z-[61] flex items-end sm:items-center justify-center sm:p-6 pointer-events-none'>
        <motion.div
          role='dialog' aria-modal='true' aria-label={product.name}
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          className='pointer-events-auto w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl grid sm:grid-cols-2'
        >
          {/* garment */}
          <div className='relative bg-[#f5f2ed] px-6 pt-8 pb-6 sm:rounded-l-3xl overflow-hidden select-none'>
            <button onClick={onClose} aria-label='Close'
              className='absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/90 border border-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center sm:hidden'>✕</button>
            <GarmentViewer ref={stageRef} product={product} kind={kind} />
          </div>

          {/* details */}
          <div className='p-6 sm:p-8 flex flex-col'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                {product.category?.name && <p className='text-[10px] tracking-[0.3em] uppercase text-gray-400 mb-2'>{product.category.name}</p>}
                <h3 className='font-serif text-2xl font-semibold text-gray-900 leading-tight'>{product.name}</h3>
              </div>
              <button onClick={onClose} aria-label='Close'
                className='hidden sm:flex w-9 h-9 flex-shrink-0 rounded-full border border-gray-200 text-gray-400 hover:text-gray-900 hover:border-gray-400 items-center justify-center transition-colors'>✕</button>
            </div>

            <motion.p key={price} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className='font-serif text-3xl font-bold text-gray-900 mt-4'>{currency}{price}</motion.p>

            {description && (
              <p className='text-sm text-gray-500 font-light leading-relaxed mt-4 line-clamp-4'>{description}</p>
            )}

            {attributeOptions.map(attr => (
              <div key={attr.name} className='mt-6'>
                <p className='text-[10px] tracking-[0.25em] uppercase font-semibold text-gray-900 mb-3'>
                  {attr.name}{selected[attr.name] && <span className='text-gray-400 font-normal normal-case tracking-normal ml-2'>{selected[attr.name]}</span>}
                </p>
                <div className='flex flex-wrap gap-2'>
                  {attr.values.map(val => {
                    const active = selected[attr.name] === val
                    const available = isOptionAvailable(attr.name, val)
                    return (
                      <motion.button key={val} whileTap={{ scale: 0.92 }}
                        onClick={() => setSelected(s => ({ ...s, [attr.name]: val }))}
                        className={`min-w-[44px] px-3 py-2 rounded-xl text-sm border transition-all ${
                          active ? 'bg-gray-900 text-white border-gray-900'
                            : available ? 'border-gray-200 text-gray-700 hover:border-gray-900'
                              : 'border-gray-100 text-gray-300 line-through'
                        }`}>
                        {val}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            ))}

            {sizes.length > 0 && (
              <div className='mt-6'>
                <p className='text-[10px] tracking-[0.25em] uppercase font-semibold text-gray-900 mb-3'>
                  Size{size && <span className='text-gray-400 font-normal normal-case tracking-normal ml-2'>{size}</span>}
                </p>
                <div className='flex flex-wrap gap-2'>
                  {sizes.map(s => (
                    <motion.button key={s} whileTap={{ scale: 0.92 }} onClick={() => setSize(s)}
                      className={`min-w-[44px] px-3 py-2 rounded-xl text-sm border transition-all ${size === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700 hover:border-gray-900'}`}>
                      {s}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {selectedVariant && (
              <p className={`text-xs mt-4 ${selectedVariant.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {selectedVariant.quantity > 0 ? (selectedVariant.quantity <= 5 ? `Only ${selectedVariant.quantity} left` : 'In stock') : 'Out of stock'}
              </p>
            )}

            <div className='mt-auto pt-8 flex flex-col gap-3'>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleAdd}
                className={`w-full py-4 rounded-full text-xs tracking-[0.25em] uppercase font-bold transition-colors duration-300 ${added ? 'bg-green-600 text-white' : 'btn-teal'}`}>
                {added ? '✓ In your bag' : 'Add to bag'}
              </motion.button>
              <FreeDeliveryBar className='pt-1' />
              <Link to={`/product/${product.seo?.slug || product.slug || product._id}`} onClick={onClose}
                className='w-full py-3.5 rounded-full text-center text-xs tracking-[0.25em] uppercase font-semibold border border-gray-200 text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors'>
                View full details
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {flyer && (
          <motion.img key='flyer' src={flyer.src} alt=''
            className='fixed z-[70] object-contain mix-blend-multiply pointer-events-none'
            initial={{ left: flyer.rect.left, top: flyer.rect.top, width: flyer.rect.width, height: flyer.rect.height, opacity: 1, rotate: 0 }}
            animate={{ left: window.innerWidth - 70, top: 24, width: 28, height: 34, opacity: 0.2, rotate: 25 }}
            transition={{ duration: 0.8, ease: [0.6, 0, 0.3, 1] }}
            onAnimationComplete={() => setFlyer(null)} />
        )}
      </AnimatePresence>
    </>,
    document.body
  )
}

export default FittingRoom

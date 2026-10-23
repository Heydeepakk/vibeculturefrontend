import React, { useContext, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ShopContext } from '../context/ShopContext'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import HangerRail from '../components/wardrobe/HangerRail'
import { garmentKind, RACKS } from '../components/wardrobe/cutout'

const Collection = () => {
  const { products, search, showSearch } = useContext(ShopContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const [sortType, setSortType] = useState('newest')
  const rack = RACKS[searchParams.get('rack')] ? searchParams.get('rack') : 'all'
  const category = searchParams.get('category') || ''

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value); else next.delete(key)
    if (key === 'rack') next.delete('category')
    setSearchParams(next, { replace: true })
  }

  const withKind = useMemo(() => products
    .filter(p => typeof p.category === 'object' && p.category)
    .map(p => ({ ...p, _kind: garmentKind(p.category) })), [products])

  // categories that hang on the selected rack
  const categories = useMemo(() => {
    const map = new Map()
    withKind.forEach(p => (rack === 'all' || p._kind === rack) && map.set(p.category._id, p.category))
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [withKind, rack])

  const racks = useMemo(() => {
    let list = withKind.filter(p =>
      (rack === 'all' || p._kind === rack) &&
      (!category || p.category._id === category) &&
      (!showSearch || !search || p.name.toLowerCase().includes(search.toLowerCase())))
    if (sortType === 'low-high') list = [...list].sort((a, b) => a.price - b.price)
    else if (sortType === 'high-low') list = [...list].sort((a, b) => b.price - a.price)
    else list = [...list].sort((a, b) => (b.date || 0) - (a.date || 0))
    return Object.keys(RACKS)
      .map(kind => ({ kind, ...RACKS[kind], products: list.filter(p => p._kind === kind) }))
      .filter(r => r.products.length)
  }, [withKind, rack, category, search, showSearch, sortType])

  const total = racks.reduce((n, r) => n + r.products.length, 0)
  const activeCategory = categories.find(c => c._id === category)
  const heading = activeCategory?.name || (rack !== 'all' ? RACKS[rack].title : 'The whole wardrobe')

  return (
    <div className='min-h-screen bg-[#f5f2ed] pb-20'>
      <Helmet>
        <title>{`${heading} | VibeCulture`}</title>
        <meta name="description" content={`Shop ${heading.toLowerCase()} at VibeCulture. Premium men's clothing with fast delivery across India.`} />
        <link rel="canonical" href="https://www.vibeculture.in/collection" />
      </Helmet>

      <div className='max-w-7xl mx-auto px-4 sm:px-10 pt-8 sm:pt-12'>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <p className='text-[10px] sm:text-xs tracking-[0.35em] uppercase text-gray-500 mb-2'>Shop · {total} pieces</p>
          <h1 className='font-serif text-3xl sm:text-5xl font-light text-gray-900 leading-none'>{heading}</h1>
        </motion.div>

        {/* rack + category + sort */}
        <div className='mt-6 flex flex-col gap-3'>
          <div className='flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0'>
            {[['all', 'All racks'], ...Object.entries(RACKS).map(([k, r]) => [k, r.title])].map(([key, label]) => (
              <button key={key} onClick={() => setParam('rack', key === 'all' ? '' : key)}
                className={`relative flex-shrink-0 px-5 py-2.5 rounded-full text-[11px] tracking-[0.2em] uppercase transition-colors ${rack === key ? 'text-white' : 'text-gray-600 hover:text-gray-900 bg-white/70 border border-gray-200'}`}>
                {rack === key && <motion.span layoutId='collection-rack' className='absolute inset-0 rounded-full bg-gray-900' transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                <span className='relative'>{label}</span>
              </button>
            ))}
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            {categories.length > 1 && categories.map(c => (
              <button key={c._id} onClick={() => setParam('category', category === c._id ? '' : c._id)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${category === c._id ? 'bg-white border-gray-900 text-gray-900' : 'border-gray-300 text-gray-500 hover:text-gray-900'}`}>
                {c.name}
              </button>
            ))}
            <select value={sortType} onChange={e => setSortType(e.target.value)}
              className='ml-auto bg-white text-gray-700 text-xs tracking-wider px-4 py-2.5 rounded-xl border border-gray-200 outline-none cursor-pointer'>
              <option value='newest'>Newest first</option>
              <option value='low-high'>Price: Low → High</option>
              <option value='high-low'>Price: High → Low</option>
            </select>
          </div>
        </div>
      </div>

      <AnimatePresence mode='wait'>
        {racks.length === 0 ? (
          <motion.p key='empty' initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className='text-center text-gray-500 text-sm py-24'>Nothing on this rack yet.</motion.p>
        ) : (
          <motion.div key={`${rack}-${category}-${sortType}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className='mt-6 flex flex-col gap-4'>
            {racks.map(r => (
              <section key={r.kind} className='relative'>
                <div className='max-w-7xl mx-auto px-4 sm:px-10 flex items-baseline justify-between'>
                  <h2 className='font-serif text-xl sm:text-2xl font-light text-gray-900'>{r.title}</h2>
                  <span className='text-[10px] tracking-[0.3em] uppercase text-gray-500'>{r.products.length} pieces</span>
                </div>
                <HangerRail products={r.products} railId={`col-${r.kind}`} />
              </section>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Collection

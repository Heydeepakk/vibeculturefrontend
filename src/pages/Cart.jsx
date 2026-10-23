import React, { useContext, useEffect, useMemo, useState } from 'react'
import { ShopContext } from '../context/ShopContext'
import Title from '../components/Title'
import { assets } from '../assets/assets'
import CartTotal from '../components/CartTotal'
import { motion, AnimatePresence } from 'framer-motion'
import HangerRail from '../components/wardrobe/HangerRail'
import Hanger from '../components/wardrobe/Hanger'
import FreeDeliveryBar from '../components/wardrobe/FreeDeliveryBar'
import { garmentKind } from '../components/wardrobe/cutout'
import { getRecentlyViewed } from '../components/wardrobe/journey'

const Cart = () => {
  const { products, currency, cartItems, updateQuantity, navigate } = useContext(ShopContext)
  const [cartData, setCartData] = useState([])

  useEffect(() => {
    if (products.length > 0) {
      const tempData = []
      for (const items in cartItems)
        for (const item in cartItems[items])
          if (cartItems[items][item] > 0)
            tempData.push({ _id: items, size: item, quantity: cartItems[items][item] })
      setCartData(tempData)
    }
  }, [cartItems, products])

  const hangable = p => typeof p.category === 'object' && p.category
  const withKind = p => ({ ...p, _kind: garmentKind(p.category) })

  // everything in the bag, hanging on its own little rail
  const bagRail = useMemo(() => [...new Set(cartData.map(i => i._id))]
    .map(id => products.find(p => p._id === id)).filter(p => p && hangable(p)).map(withKind), [cartData, products])

  // "complete the look": first the racks the bag doesn't cover yet (tee in bag → lowers, jeans…), then the rest
  const suggestions = useMemo(() => {
    const inBag = new Set(bagRail.map(p => p._id))
    const kinds = new Set(bagRail.map(p => p._kind))
    const rest = products.filter(p => hangable(p) && !inBag.has(p._id)).map(withKind)
    return [...rest.filter(p => !kinds.has(p._kind)), ...rest.filter(p => kinds.has(p._kind))].slice(0, 12)
  }, [bagRail, products])

  const recent = useMemo(() => getRecentlyViewed()
    .map(id => products.find(p => p._id === id)).filter(p => p && hangable(p)).map(withKind), [products])

  const getItemPrice = (p, size) => p?.variants?.[size] ? p.variants[size].price : p?.price || 0
  const getVariantInfo = (p, size) => p?.variants?.[size]?.attributes || null

  return (
    <div className='min-h-screen bg-gray-50 pt-6 pb-20 px-4 sm:px-6'>
      <div className='max-w-5xl mx-auto'>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className='py-10 border-b border-gray-200 mb-8'>
          <Title text1='YOUR' text2='CART' />
        </motion.div>

        {cartData.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className='text-center py-24'>
            <motion.div className='w-32 mx-auto mb-6' style={{ transformOrigin: '50% 5%' }}
              animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
              <Hanger kind='tshirt' className='w-full' />
            </motion.div>
            <h3 className='font-serif text-2xl text-gray-700 italic mb-3'>Your bag is empty</h3>
            <p className='text-gray-500 text-sm mb-8'>This hanger is waiting for something you&apos;ll love</p>
            <button onClick={() => navigate('/collection')} className='bg-gray-900 text-white hover:bg-black px-10 py-4 rounded-full text-sm tracking-widest uppercase transition-all'>
              Start Shopping
            </button>
            {recent.length > 0 && (
              <div className='mt-16 -mx-4 sm:-mx-6 bg-[#f5f2ed] rounded-3xl pt-8 text-left'>
                <h2 className='px-6 sm:px-10 font-serif text-2xl font-light text-gray-900'>You picked these up earlier</h2>
                <HangerRail products={recent} railId='cart-recent' />
              </div>
            )}
          </motion.div>
        ) : (
          <>
            {bagRail.length > 0 && (
              <div className='-mx-4 sm:-mx-6 bg-[#f5f2ed] rounded-3xl pt-6 mb-6'>
                <div className='px-6 sm:px-10 flex items-baseline justify-between'>
                  <h2 className='font-serif text-xl sm:text-2xl font-light text-gray-900'>Your bag, on the rail</h2>
                  <span className='text-[10px] tracking-[0.3em] uppercase text-gray-500'>{bagRail.length} {bagRail.length === 1 ? 'piece' : 'pieces'}</span>
                </div>
                <HangerRail products={bagRail} railId='cart-bag' />
              </div>
            )}

            <FreeDeliveryBar className='bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6' />

            <div className='space-y-3 mb-10'>
              <AnimatePresence>
                {cartData.map((item, index) => {
                  const productData = products.find(p => p._id === item._id)
                  if (!productData) return null
                  const itemPrice = getItemPrice(productData, item.size)
                  const variantInfo = getVariantInfo(productData, item.size)

                  return (
                    <motion.div key={`${item._id}-${item.size}`}
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className='bg-white rounded-2xl p-4 border border-gray-100 hover:border-gray-300 transition-all duration-300 flex items-center gap-4 shadow-sm'>

                      {/* Image */}
                      <div className='w-16 sm:w-20 flex-shrink-0 rounded-xl overflow-hidden border border-gray-100'>
                        <img src={productData.image[0]} alt='' className='w-full aspect-square object-cover' />
                      </div>

                      {/* Info */}
                      <div className='flex-1 min-w-0'>
                        <p className='text-gray-800 text-sm font-medium line-clamp-1'>{productData.name}</p>
                        <div className='flex flex-wrap items-center gap-2 mt-1'>
                          <span className='font-serif text-base font-semibold text-gray-900'>{currency}{itemPrice}</span>
                          {variantInfo ? variantInfo.map((a, i) => (
                            <span key={i} className='bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded-full border border-gray-200'>
                              {a.attributeName}: {a.variantValue}
                            </span>
                          )) : item.size !== '0' && (
                            <span className='bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full border border-gray-200'>{item.size}</span>
                          )}
                        </div>
                        <p className='text-gray-500 text-xs mt-1'>Subtotal: {currency}{itemPrice * item.quantity}</p>
                      </div>

                      {/* Qty controls */}
                      <div className='flex items-center gap-1 bg-gray-50 rounded-full px-2 py-1 border border-gray-200'>
                        <button onClick={() => item.quantity > 1 && updateQuantity(item._id, item.size, item.quantity - 1)}
                          className='w-6 h-6 flex items-center justify-center text-gray-600 hover:text-[#0d6b9f] transition-colors font-bold text-lg'>−</button>
                        <span className='w-6 text-center text-sm text-gray-700 font-medium'>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item._id, item.size, item.quantity + 1)}
                          className='w-6 h-6 flex items-center justify-center text-gray-600 hover:text-[#0d6b9f] transition-colors font-bold text-lg'>+</button>
                      </div>

                      {/* Delete */}
                      <button onClick={() => updateQuantity(item._id, item.size, 0)}
                        className='p-2 text-gray-400 hover:text-red-400 transition-colors duration-200'>
                        <img src={assets.bin_icon} className='w-4 invert opacity-30 hover:opacity-70 transition-opacity' alt='Remove' />
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>

            <div className='flex justify-end'>
              <div className='w-full sm:w-[420px]'>
                <div className='bg-white rounded-2xl p-6 border border-gray-100 mb-4 shadow-sm'>
                  <CartTotal />
                </div>
                <button onClick={() => navigate('/place-order')}
                  className='w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl text-sm tracking-widest uppercase font-bold mb-3 transition-all duration-300'>
                  Proceed to Checkout →
                </button>
                <button onClick={() => navigate('/collection')}
                  className='w-full bg-white text-gray-600 hover:text-gray-900 py-3 rounded-2xl text-sm tracking-wider border border-gray-200 hover:border-gray-400 transition-all duration-300'>
                  Continue Shopping
                </button>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className='mt-14 -mx-4 sm:-mx-6 bg-[#f5f2ed] rounded-3xl pt-8'>
                <div className='px-6 sm:px-10'>
                  <p className='text-[10px] tracking-[0.35em] uppercase text-gray-500 mb-1'>Complete the look</p>
                  <h2 className='font-serif text-2xl font-light text-gray-900'>Goes well with what&apos;s in your bag</h2>
                </div>
                <HangerRail products={suggestions} railId='cart-suggest' />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Cart

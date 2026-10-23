import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../context/ShopContext'
import Title from '../components/Title'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import OrderCelebration from '../components/wardrobe/OrderCelebration'
import { takeJustOrdered } from '../components/wardrobe/journey'

const STEPS = ['Order Placed', 'Packing', 'Shipped', 'Out for delivery', 'Delivered']

const stepIcon = (step) => {
  const icons = { 'Order Placed': '🛒', 'Packing': '📦', 'Shipped': '🚚', 'Out for delivery': '🏃', 'Delivered': '✅' }
  return icons[step] || '•'
}

const getStepIndex = (status) => {
  const idx = STEPS.findIndex(s => s.toLowerCase() === status?.toLowerCase())
  return idx === -1 ? 0 : idx
}

const TrackingTimeline = ({ status }) => {
  const current = getStepIndex(status)
  return (
    <div className='pt-4 pb-2'>
      <div className='relative flex items-start justify-between'>
        {/* connecting line */}
        <div className='absolute top-4 left-0 right-0 h-[2px] bg-white/10' />
        <div
          className='absolute top-4 left-0 h-[2px] bg-gradient-to-r from-[#0d6b9f] to-[#1e8bc3] transition-all duration-700'
          style={{ width: `${(current / (STEPS.length - 1)) * 100}%` }}
        />

        {STEPS.map((step, i) => {
          const done = i <= current
          const active = i === current
          return (
            <div key={step} className='relative flex flex-col items-center gap-2 z-10' style={{ width: `${100 / STEPS.length}%` }}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all duration-500 ${
                done
                  ? 'border-[#0d6b9f] bg-[#0d6b9f]/20 text-white'
                  : 'border-white/15 bg-[#f8f9fa] text-gray-400'
              } ${active ? 'ring-2 ring-[#0d6b9f]/40 ring-offset-1 ring-offset-[#f8f9fa]' : ''}`}>
                {stepIcon(step)}
              </div>
              <p className={`text-[10px] text-center leading-tight transition-colors duration-300 ${done ? 'text-gray-700' : 'text-gray-400'} ${active ? 'text-[#0d6b9f] font-semibold' : ''}`}>
                {step}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const statusDot = (status) => {
  if (!status) return 'bg-white/20'
  const s = status.toLowerCase()
  if (s === 'delivered') return 'bg-green-400'
  if (s === 'cancelled') return 'bg-red-400'
  if (s.includes('ship') || s.includes('delivery')) return 'bg-blue-400'
  return 'bg-[#0d6b9f]'
}

const Orders = () => {
  const { backendUrl, token, currency } = useContext(ShopContext)
  const [orderData, setOrderData] = useState([])
  const [tracking, setTracking] = useState(null)
  const [celebrate, setCelebrate] = useState(takeJustOrdered)

  const loadOrderData = async () => {
    try {
      if (!token) return
      const response = await axios.post(backendUrl + '/api/order/userorders', {}, { headers: { token } })
      if (response.data.success) {
        let all = []
        response.data.orders.forEach(order => {
          order.items.forEach(item => {
            all.push({ ...item, status: order.status, payment: order.payment, paymentMethod: order.paymentMethod, date: order.date })
          })
        })
        setOrderData(all.reverse())
      }
    } catch (error) {}
  }

  useEffect(() => { loadOrderData() }, [token])

  return (
    <div className='min-h-screen bg-[#f8f9fa] pt-6 pb-20 px-4 sm:px-6'>
      <AnimatePresence>{celebrate && <OrderCelebration onDone={() => setCelebrate(false)} />}</AnimatePresence>
      <div className='max-w-4xl mx-auto'>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className='py-10 border-b border-[#0d6b9f]/10 mb-10'>
          <Title text1='MY' text2='ORDERS' />
        </motion.div>

        {orderData.length === 0
          ? <div className='text-center text-gray-600 py-20 text-sm tracking-widest uppercase'>No orders yet</div>
          : <div className='space-y-4'>
              {orderData.map((item, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
                  className='glass rounded-2xl border border-[#0d6b9f]/15 overflow-hidden bg-white'>

                  {/* Order row */}
                  <div className='p-5 flex flex-col sm:flex-row sm:items-center gap-5'>

                    <img src={item.image[0]} alt={item.name} className='w-20 h-20 object-cover rounded-xl border border-[#0d6b9f]/15 flex-shrink-0' />

                    <div className='flex-1 space-y-1'>
                      <p className='text-gray-900 font-semibold text-base'>{item.name}</p>
                      <div className='flex flex-wrap items-center gap-3 text-sm text-white/60'>
                        <span className='gold-text font-bold'>{currency}{item.price}</span>
                        <span>·</span>
                        <span>Qty: {item.quantity}</span>
                        <span>·</span>
                        {item.size !== '0' && <span>Size: {item.size}</span>}
                      </div>
                      <div className='flex flex-wrap gap-4 text-xs text-gray-600 pt-1'>
                        <span>{new Date(item.date).toDateString()}</span>
                        <span>via {item.paymentMethod}</span>
                      </div>
                    </div>

                    <div className='flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 flex-shrink-0'>
                      <div className='flex items-center gap-2'>
                        <span className={`w-2 h-2 rounded-full ${statusDot(item.status)}`} />
                        <span className='text-sm text-white/80 font-medium'>{item.status}</span>
                      </div>
                      <button
                        onClick={() => setTracking(tracking === index ? null : index)}
                        className='text-xs border border-[#0d6b9f]/30 text-[#0d6b9f] px-4 py-1.5 rounded-lg hover:bg-[#0d6b9f]/10 transition-all duration-200 tracking-wider'>
                        {tracking === index ? 'Hide' : 'Track Order'}
                      </button>
                    </div>
                  </div>

                  {/* Tracking timeline */}
                  <AnimatePresence>
                    {tracking === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className='overflow-hidden border-t border-[#0d6b9f]/10 px-5'>
                        <TrackingTimeline status={item.status} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

export default Orders

import React, { useContext } from 'react'
import { motion } from 'framer-motion'
import { ShopContext } from '../../context/ShopContext'

// "₹X away from free delivery" with a little van that drives along as the bag fills up.
const FreeDeliveryBar = ({ extra = 0, className = '' }) => {
  const { getCartAmount, free_delivery_threshold: goal, currency } = useContext(ShopContext)
  if (!goal) return null
  const amount = getCartAmount() + extra
  const progress = Math.min(1, amount / goal)
  const done = amount >= goal

  return (
    <div className={className}>
      <p className={`text-[11px] mb-2 ${done ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
        {done ? 'Free delivery unlocked ✓' : amount > 0
          ? <>Add <b>{currency}{Math.ceil(goal - amount)}</b> more for free delivery</>
          : <>Free delivery on orders over {currency}{goal}</>}
      </p>
      <div className='relative h-1.5 rounded-full bg-gray-200'>
        <motion.div className={`absolute inset-y-0 left-0 rounded-full ${done ? 'bg-green-600' : 'bg-gray-900'}`}
          initial={false} animate={{ width: `${progress * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 18 }} />
        <motion.span className='absolute -top-[13px] text-base select-none' aria-hidden='true'
          initial={false} animate={{ left: `calc(${progress * 100}% - 10px)` }} transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          style={{ transform: 'scaleX(-1)' }}>
          🚚
        </motion.span>
      </div>
    </div>
  )
}

export default FreeDeliveryBar

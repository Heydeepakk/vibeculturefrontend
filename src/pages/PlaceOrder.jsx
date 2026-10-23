import React, { useContext, useEffect, useState } from 'react'
import Title from '../components/Title'
import CartTotal from '../components/CartTotal'
import { assets } from '../assets/assets'
import { markJustOrdered } from '../components/wardrobe/journey'
import { ShopContext } from '../context/ShopContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { motion } from 'framer-motion'

const inputCls = 'w-full bg-gray-50 border border-[#0d6b9f]/25 rounded-xl py-3 px-4 text-gray-900 text-base placeholder-gray-400 focus:outline-none focus:border-[#0d6b9f]/70 focus:ring-1 focus:ring-[#0d6b9f]/30 transition-all duration-300'

const PlaceOrder = () => {
  const [method, setMethod] = useState('razorpay') 
  const { navigate, backendUrl, token, cartItems, setCartItems, getCartAmount, getDeliveryFee, products, userAddress, email } = useContext(ShopContext)
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', street: '',
    city: '', state: '', zipcode: '', country: '', phone: ''
  })
  const [deliveryFee, setDeliveryFee] = useState(0);

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    console.log('Fetching user address...', email)
    if (userAddress) {
      setFormData(prev => ({
        ...prev,
        firstName: userAddress.firstName || '',
        lastName:  userAddress.lastName  || '',
        email:     email|| '',
        street:    userAddress.street    || '',
        city:      userAddress.city      || '',
        state:     userAddress.state     || '',
        zipcode:   userAddress.zipcode   || '',
        country:   userAddress.country   || '',
        phone:     userAddress.phone     || '',
      }))
    }

    // Fetch delivery charges based on cart amount
    const fetchDeliveryFee = async () => {
      const fee = await getDeliveryFee(getCartAmount());
      setDeliveryFee(fee);
    };
    fetchDeliveryFee();
  }, [token, userAddress, getCartAmount])

  const onChange = e => setFormData(d => ({ ...d, [e.target.name]: e.target.value }))

  const initPay = (order) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount, currency: order.currency,
      name: 'Order Payment', description: 'Order Payment',
      order_id: order.id,
      handler: async (response) => {
        try {
          const { data } = await axios.post(backendUrl + '/api/order/verifyRazorpay',
            { ...response, userId: undefined }, { headers: { token } })
          if (data.success) { markJustOrdered(); navigate('/orders'); setCartItems({}) }
          else toast.error(data.message)
        } catch (error) { toast.error(error.message) }
      },
      modal: { ondismiss: () => toast.error('Payment cancelled') },
      prefill: { name: `${formData.firstName} ${formData.lastName}`, email: formData.email, contact: formData.phone }
    }
    new window.Razorpay(options).open()
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    try {
      let orderItems = []
      for (const items in cartItems)
        for (const item in cartItems[items])
          if (cartItems[items][item] > 0) {
            const itemInfo = structuredClone(products.find(p => p._id === items))
            if (itemInfo) { itemInfo.size = item; itemInfo.quantity = cartItems[items][item]; orderItems.push(itemInfo) }
          }

      const orderData = { address: formData, items: orderItems, amount: getCartAmount() + deliveryFee }

      const { data } = await axios.post(backendUrl + '/api/order/razorpay', orderData, { headers: { token } })
      if (data.success) initPay(data.order)
    } catch (error) { toast.error(error.message) }
  }

  return (
    <div className='min-h-screen bg-[#f8f9fa] pt-6 pb-20 px-4 sm:px-6'>
      <div className='max-w-6xl mx-auto'>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className='py-10 border-b border-[#0d6b9f]/10 mb-10'>
          <Title text1='SECURE' text2='CHECKOUT' />
        </motion.div>

        <form onSubmit={onSubmit}>
          <div className='flex flex-col xl:flex-row gap-8'>

            {/* Left — Delivery */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className='flex-1 xl:max-w-[500px]'>
              <div className='glass rounded-2xl p-6 border border-[#0d6b9f]/15 bg-white'>
                <div className='flex items-center gap-3 mb-6'>
                  <span className='w-7 h-7 btn-gold rounded-full flex items-center justify-center text-xs font-black'>1</span>
                  <h3 className='text-gray-900 font-semibold tracking-wider text-sm uppercase'>Delivery Information</h3>
                </div>
                <div className='space-y-3'>
                  <div className='flex gap-3'>
                    <input required onChange={onChange} name='firstName' value={formData.firstName} className={inputCls} type='text' placeholder='First name' />
                    <input required onChange={onChange} name='lastName' value={formData.lastName} className={inputCls} type='text' placeholder='Last name' />
                  </div>
                  <input required onChange={onChange} name='email' value={formData.email} className={inputCls} type='email' placeholder='Email address' />
                  <input required onChange={onChange} name='phone' value={formData.phone} className={inputCls} type='number' placeholder='Phone number' />
                  <input required onChange={onChange} name='street' value={formData.street} className={inputCls} type='text' placeholder='Street address' />
                  <div className='flex gap-3'>
                    <input required onChange={onChange} name='city' value={formData.city} className={inputCls} type='text' placeholder='City' />
                    <input onChange={onChange} name='state' value={formData.state} className={inputCls} type='text' placeholder='State' />
                  </div>
                  <div className='flex gap-3'>
                    <input required onChange={onChange} name='zipcode' value={formData.zipcode} className={inputCls} type='number' placeholder='Zipcode' />
                    <input required onChange={onChange} name='country' value={formData.country} className={inputCls} type='text' placeholder='Country' />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right — Summary + Payment */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className='w-full xl:max-w-md space-y-4'>

              {/* Order Summary */}
              <div className='glass rounded-2xl p-6 border border-[#0d6b9f]/15 bg-white'>
                <div className='flex items-center gap-3 mb-5'>
                  <span className='w-7 h-7 btn-gold rounded-full flex items-center justify-center text-xs font-black'>2</span>
                  <h3 className='text-gray-900 font-semibold tracking-wider text-sm uppercase'>Order Summary</h3>
                </div>
                <CartTotal />
              </div>

              {/* Payment */}
              <div className='glass rounded-2xl p-6 border border-[#0d6b9f]/15 bg-white'>
                <div className='flex items-center gap-3 mb-5'>
                  <span className='w-7 h-7 btn-gold rounded-full flex items-center justify-center text-xs font-black'>3</span>
                  <h3 className='text-gray-900 font-semibold tracking-wider text-sm uppercase'>Payment Method</h3>
                </div>

                <div className='flex items-center gap-3 p-4 rounded-xl border-2 border-[#0d6b9f]/60 bg-[#0d6b9f]/5'>
                  <div className='w-4 h-4 rounded-full border-2 border-[#0d6b9f] flex items-center justify-center flex-shrink-0'>
                    <div className='w-2 h-2 bg-[#0d6b9f] rounded-full' />
                  </div>
                  <img src={assets.razorpay_logo} className='h-5 brightness-0 invert opacity-90' alt='razorpay' />
                </div>

                <motion.button type='submit' whileTap={{ scale: 0.98 }}
                  className='w-full btn-gold py-4 rounded-2xl text-sm tracking-widest uppercase mt-6'>
                  Place Order ✦
                </motion.button>

                <div className='flex items-center justify-center gap-4 mt-4 text-[10px] text-gray-600 tracking-wider'>
                  <span>🔒 SECURE</span><span>•</span><span>📦 FAST</span><span>•</span><span>↩️ EASY RETURNS</span>
                </div>
              </div>
            </motion.div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PlaceOrder

import React, { useContext, useState, useEffect } from 'react'
import { assets } from '../assets/assets'
import { Link, NavLink } from 'react-router-dom'
import { ShopContext } from '../context/ShopContext'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

const Navbar = () => {
  const [visible, setVisible] = useState(false)
  const [logo, setLogo] = useState()
  const [categories, setCategories] = useState([])
  const [scrolled, setScrolled] = useState(false)
  const { setShowSearch, getCartCount, navigate, token, setToken, setCartItems, backendUrl } = useContext(ShopContext)

  useEffect(() => {
    axios.get(backendUrl + '/api/header/get').then(r => r.data.success && r.data.data && setLogo(r.data.data.logo)).catch(() => {})
    axios.get(backendUrl + '/api/category/list').then(r => r.data.success && setCategories(r.data.categories)).catch(() => {})
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const logout = () => { navigate('/login'); localStorage.removeItem('token'); setToken(''); setCartItems({}) }

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/collection', label: 'Shop' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ]

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-white/80 backdrop-blur-sm'}`}
        initial={{ y: -80 }} animate={{ y: 0 }} transition={{ duration: 0.6 }}
      >
        <div className='flex items-center justify-between py-4 px-6 sm:px-10 max-w-7xl mx-auto'>

          {/* Logo */}
          <Link to='/' className='flex items-center gap-3 group'>
            {logo
              ? <img src={logo} className='h-12 sm:h-14 w-auto object-contain' alt='VibeCulture' />
              : <img src='/logo.png' className='h-12 sm:h-14 w-auto object-contain' alt='VibeCulture' />
            }
          </Link>

          {/* Desktop nav */}
          <ul className='hidden md:flex items-center gap-8'>
            {navLinks.map(({ to, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `text-sm tracking-widest uppercase transition-all duration-300 relative group ${isActive ? 'text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-900'}`
                }>
                {label}
                <span className='absolute -bottom-1 left-0 w-0 h-[1px] bg-gray-900 group-hover:w-full transition-all duration-300' />
              </NavLink>
            ))}

            {/* Categories dropdown */}
            {categories.length > 0 && (
              <div className='relative group'>
                <button className='text-sm tracking-widest uppercase text-gray-500 hover:text-gray-900 transition-colors duration-300'>
                  Categories ▾
                </button>
                <div className='absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300'>
                  <div className='bg-white rounded-2xl py-3 px-2 min-w-[180px] border border-gray-100 shadow-xl'>
                    {categories.map(cat => (
                      <Link key={cat._id} to={`/collection?category=${cat._id}`}
                        className='block px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all duration-200'>
                        ✦ {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ul>

          {/* Actions */}
          <div className='flex items-center gap-2 sm:gap-4'>
            <button onClick={() => { setShowSearch(true); navigate('/collection') }}
              className='p-2 text-gray-500 hover:text-gray-900 transition-colors duration-300'>
              <img src={assets.search_icon} className='w-5 opacity-60 hover:opacity-100 transition-opacity' alt='Search' />
            </button>

            <div className='relative group'>
              <button onClick={() => !token && navigate('/login')}
                className='p-2 text-gray-500 hover:text-gray-900 transition-colors duration-300'>
                <img src={assets.profile_icon} className='w-5 opacity-60 hover:opacity-100 transition-opacity' alt='Profile' />
              </button>
              {token && (
                <div className='group-hover:block hidden absolute right-0 top-full pt-3 z-50'>
                  <div className='bg-white rounded-2xl py-3 px-2 w-40 border border-gray-100 shadow-xl'>
                    <p onClick={() => navigate('/profile')} className='px-4 py-2 text-sm text-gray-600 hover:text-gray-900 cursor-pointer rounded-xl hover:bg-gray-50 transition-all'>My Profile</p>
                    <p onClick={() => navigate('/orders')} className='px-4 py-2 text-sm text-gray-600 hover:text-gray-900 cursor-pointer rounded-xl hover:bg-gray-50 transition-all'>My Orders</p>
                    <hr className='border-gray-100 my-1' />
                    <p onClick={logout} className='px-4 py-2 text-sm text-red-500 hover:text-red-600 cursor-pointer rounded-xl hover:bg-red-50 transition-all'>Logout</p>
                  </div>
                </div>
              )}
            </div>

            <Link to='/cart' className='relative p-2'>
              <img src={assets.cart_icon} className='w-5 opacity-60 hover:opacity-100 transition-opacity' alt='Cart' />
              <AnimatePresence>
                {getCartCount() > 0 && (
                  <motion.span key={`badge-${getCartCount()}`}
                    initial={{ scale: 0.4 }} animate={{ scale: [1.5, 0.9, 1] }} exit={{ scale: 0 }}
                    transition={{ duration: 0.45 }}
                    className='absolute -top-0.5 -right-0.5 w-4 h-4 bg-gray-900 text-white rounded-full text-[9px] font-black flex items-center justify-center'>
                    {getCartCount()}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>

            <button onClick={() => setVisible(true)} className='md:hidden p-2'>
              <img src={assets.menu_icon} className='w-5 opacity-60' alt='Menu' />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Spacer for fixed nav */}
      <div className='h-20' />

      {/* Mobile sidebar */}
      <AnimatePresence>
        {visible && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setVisible(false)}
              className='fixed inset-0 bg-black/20 backdrop-blur-sm z-50' />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className='fixed top-0 right-0 bottom-0 w-72 bg-white border-l border-gray-100 z-50 flex flex-col shadow-2xl'>
              <div className='flex items-center justify-between p-6 border-b border-gray-100'>
                <span className='font-serif text-xl font-bold text-gray-900 tracking-widest uppercase'>Menu</span>
                <button onClick={() => setVisible(false)} className='text-gray-400 hover:text-gray-600 text-2xl'>✕</button>
              </div>
              <div className='flex-1 overflow-y-auto p-4 space-y-1'>
                {navLinks.map(({ to, label }) => (
                  <NavLink key={to} to={to} onClick={() => setVisible(false)}
                    className='block py-3 px-4 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all text-sm tracking-wider uppercase'>
                    {label}
                  </NavLink>
                ))}
                <div className='pt-2 border-t border-gray-100'>
                  <p className='text-gray-400 text-xs tracking-widest uppercase px-4 py-2'>Categories</p>
                  {categories.map(cat => (
                    <Link key={cat._id} to={`/collection?category=${cat._id}`} onClick={() => setVisible(false)}
                      className='block py-2.5 px-4 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all text-sm'>
                      ✦ {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default Navbar

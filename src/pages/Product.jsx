import React, { useContext, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams } from 'react-router-dom'
import { ShopContext } from '../context/ShopContext'
import HangerRail from '../components/wardrobe/HangerRail'
import GarmentViewer from '../components/wardrobe/GarmentViewer'
import { garmentKind, RACKS } from '../components/wardrobe/cutout'
import { rememberViewed } from '../components/wardrobe/journey'
import FreeDeliveryBar from '../components/wardrobe/FreeDeliveryBar'
import { toast } from 'react-toastify'
import { motion, AnimatePresence } from 'framer-motion'

const Product = () => {
  const { productId } = useParams()
  const { products, currency, addToCart } = useContext(ShopContext)
  const [productData, setProductData] = useState(false)
  const [size, setSize] = useState('')
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [availableVariants, setAvailableVariants] = useState([])
  const [selectedAttributes, setSelectedAttributes] = useState({})
  const [attributeOptions, setAttributeOptions] = useState([])
  const [addedAnim, setAddedAnim] = useState(false)
  const [copied, setCopied] = useState(false)

  const setupAttributeOptions = (variants) => {
    const attributes = {}
    variants.forEach(v => v.attributes.forEach(a => {
      if (!attributes[a.attributeName]) attributes[a.attributeName] = new Set()
      attributes[a.attributeName].add(a.variantValue)
    }))
    setAttributeOptions(Object.keys(attributes).map(name => ({ name, values: Array.from(attributes[name]) })))
  }

  useEffect(() => {
    if (!products.length || !productId) return
    const item = products.find(i =>
      i._id === productId || i.seo?.slug === productId
    )
    if (item) {
      rememberViewed(item._id)
      setProductData(item)
      setSize('')
      if (item.variants?.length > 0) {
        setAvailableVariants(item.variants)
        setupAttributeOptions(item.variants)
        setSelectedVariant(null)
        setSelectedAttributes({})
      } else {
        setAvailableVariants([])
        setAttributeOptions([])
        setSelectedVariant(null)
        setSelectedAttributes({})
      }
    } else {
      setProductData(false)
    }
  }, [productId, products])

  const handleAttributeChange = (attributeName, value) => {
    const newSelected = { ...selectedAttributes, [attributeName]: value }
    setSelectedAttributes(newSelected)
    if (attributeOptions.every(a => newSelected[a.name])) {
      const match = availableVariants.find(v => v.attributes.every(a => newSelected[a.attributeName] === a.variantValue))
      setSelectedVariant(match || null)
    } else setSelectedVariant(null)
  }

  const hasVariants = availableVariants.length > 0
  const sizes = hasVariants ? [] : (productData?.sizes || [])
  const kind = productData ? garmentKind(productData.category) : 'tshirt'
  const moreFromRack = useMemo(() => products
    .filter(p => p._id !== productData?._id && typeof p.category === 'object' && p.category && garmentKind(p.category) === kind)
    .map(p => ({ ...p, _kind: kind })), [products, productData, kind])

  const handleAddToCart = () => {
    if (hasVariants) {
      if (!selectedVariant) { toast.error('Please select all options'); return }
      if (selectedVariant.quantity === 0) { toast.error('Out of stock'); return }
      addToCart(productData._id, availableVariants.indexOf(selectedVariant).toString())
    } else if (sizes.length) {
      if (!size) { toast.error('Please choose a size'); return }
      addToCart(productData._id, size)
    } else {
      addToCart(productData._id, '0')
    }
    setAddedAnim(true)
    setTimeout(() => setAddedAnim(false), 1500)
    toast.success(
      <div className='flex items-center gap-3'>
        <img src={productData.image[0]} alt='' className='w-10 h-10 object-cover rounded-lg' />
        <div>
          <p className='font-semibold text-sm'>{productData.name}</p>
          <p className='text-xs text-gray-400'>Added to cart!</p>
        </div>
      </div>
    )
  }

  if (!productData) return <div className='min-h-screen bg-gray-50' />

  const currentPrice = selectedVariant ? selectedVariant.price : productData.price

  const productKey = productData.seo?.slug || productData._id
  const productUrl = `https://www.vibeculture.in/product/${productKey}`
  // Prefer gallery image — seo.ogImage is often a broken/stale Cloudinary URL
  const rawOg = productData.image?.[0] || productData.seo?.ogImage || 'https://www.vibeculture.in/logo.png'
  const ogImage = rawOg.includes('res.cloudinary.com') && rawOg.includes('/upload/') && !/\/upload\/[^/]*f_/.test(rawOg)
    ? rawOg.replace('/upload/', '/upload/f_jpg,w_1200,h_1200,c_fill,q_auto:good/')
    : rawOg
  const plainDesc = String(productData.description || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160)
  const categoryName = typeof productData.category === 'object' ? productData.category?.name : productData.category
  const shareText = `${productData.name}\n₹${currentPrice}${categoryName ? ` · ${categoryName}` : ''}${plainDesc ? `\n${plainDesc}` : ''}\n\nShop now: ${productUrl}`

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: productData.name, text: shareText, url: productUrl })
        return
      }
    } catch (_) { /* user cancelled */ }
    navigator.clipboard.writeText(productUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
  }

  const inStock = selectedVariant ? selectedVariant.quantity > 0 : productData.variants?.some(v => v.quantity > 0) ?? true
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productData.name,
    image: productData.image,
    description: String(productData.description || '').replace(/<[^>]+>/g, '').slice(0, 300),
    sku: String(selectedVariant?.sku || productData._id),
    mpn: String(selectedVariant?.sku || productData._id),
    brand: { '@type': 'Brand', name: 'VibeCulture' },
    offers: {
      '@type': 'Offer',
      price: String(currentPrice),
      priceCurrency: 'INR',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: 'https://www.vibeculture.in/product/' + (productData.seo?.slug || productData._id),
      seller: { '@type': 'Organization', name: 'VibeCulture' },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'INR' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 7, unitCode: 'DAY' }
        },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' }
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'IN',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 7,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn'
      }
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='min-h-screen bg-gray-50 pt-6 pb-20 px-4 sm:px-6'>
      <Helmet>
        <title>{productData.seo?.metaTitle || `${productData.name} | VibeCulture`}</title>
        <meta name="description" content={productData.seo?.metaDescription || `Buy ${productData.name} at VibeCulture. ${plainDesc.slice(0, 120)}`} />
        {productData.seo?.metaKeywords && <meta name="keywords" content={productData.seo.metaKeywords} />}
        <link rel="canonical" href={productData.seo?.canonicalUrl || productUrl} />
        <meta property="og:title" content={productData.seo?.metaTitle || productData.name} />
        <meta property="og:description" content={productData.seo?.metaDescription || plainDesc || `Buy ${productData.name} for ₹${currentPrice} at VibeCulture`} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="1200" />
        <meta property="og:image:alt" content={productData.name} />
        <meta property="og:url" content={productUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="VibeCulture" />
        <meta property="product:price:amount" content={String(currentPrice)} />
        <meta property="product:price:currency" content="INR" />
        <meta property="product:availability" content={inStock ? 'in stock' : 'out of stock'} />
        <meta property="product:brand" content="VibeCulture" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={productData.seo?.metaTitle || productData.name} />
        <meta name="twitter:description" content={productData.seo?.metaDescription || plainDesc} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      </Helmet>

      <div className='max-w-6xl mx-auto'>
        <div className='flex gap-8 lg:gap-16 flex-col lg:flex-row'>

          {/* The garment on its hanger: drag to turn, Front / Back */}
          <div className='flex-1 bg-[#f5f2ed] rounded-3xl px-6 pt-10 pb-6 overflow-hidden'>
            <GarmentViewer key={productData._id} product={productData} kind={kind} className='w-[min(78%,380px)]' />
          </div>

          {/* Product Info */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            className='flex-1 lg:max-w-md'>

            <span className='inline-block bg-gray-100 text-gray-700 text-[10px] tracking-[0.25em] uppercase px-3 py-1.5 rounded-full border border-gray-200 mb-4'>
              ✦ {categoryName}
            </span>

            <h1 className='font-serif text-3xl sm:text-4xl font-light text-gray-900 leading-tight mb-3 italic'>
              {productData.name}
            </h1>
            <p className='text-gray-500 text-xs tracking-widest uppercase mb-5'>Hangs on the {RACKS[kind].title} rack</p>

            <div className='flex items-baseline gap-3 mb-6 pb-6 border-b border-gray-200'>
              <span className='font-serif text-4xl font-bold text-gray-900'>{currency}{currentPrice}</span>
              {selectedVariant && (
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${selectedVariant.quantity > 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                  {selectedVariant.quantity > 0 ? `${selectedVariant.quantity} in stock` : 'Out of stock'}
                </span>
              )}
            </div>

            {availableVariants.length > 0 && (
              <div className='space-y-5 mb-7'>
                {attributeOptions.map((attr, i) => (
                  <div key={i}>
                    <p className='text-gray-500 text-xs tracking-widest uppercase mb-3'>{attr.name}</p>
                    <div className='flex flex-wrap gap-2'>
                      {attr.values.map((val, j) => (
                        <motion.button key={j} whileTap={{ scale: 0.95 }}
                          onClick={() => handleAttributeChange(attr.name, val)}
                          className={`px-4 py-2 rounded-xl text-sm transition-all duration-300 border ${
                            selectedAttributes[attr.name] === val
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-500 hover:text-gray-900'
                          }`}>
                          {val}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sizes.length > 0 && (
              <div className='mb-7'>
                <p className='text-gray-500 text-xs tracking-widest uppercase mb-3'>Size{size && <span className='text-gray-900 ml-2'>{size}</span>}</p>
                <div className='flex flex-wrap gap-2'>
                  {sizes.map(s => (
                    <motion.button key={s} whileTap={{ scale: 0.95 }} onClick={() => setSize(s)}
                      className={`min-w-[52px] px-4 py-2 rounded-xl text-sm transition-all duration-300 border ${size === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-500 hover:text-gray-900'}`}>
                      {s}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            <motion.button
              onClick={handleAddToCart}
              disabled={hasVariants ? (!selectedVariant || selectedVariant?.quantity === 0) : false}
              whileTap={{ scale: 0.97 }}
              animate={addedAnim ? { scale: [1, 1.05, 1] } : {}}
              className='w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl text-sm tracking-widest uppercase font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 mb-4'>
              {addedAnim ? '✓ Added to Cart!' : (hasVariants && selectedVariant?.quantity === 0) ? 'Out of Stock' : '🛒 Add to Cart'}
            </motion.button>

            <FreeDeliveryBar className='mb-5' />

            <div className='flex gap-2'>
              <motion.button whileTap={{ scale: 0.95 }} onClick={handleWhatsApp} title='Share on WhatsApp'
                className='flex-1 h-12 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl flex items-center justify-center transition-colors duration-300'>
                <svg viewBox='0 0 24 24' className='w-5 h-5 fill-white'><path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'/></svg>
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={handleShare} title='Copy link'
                className='flex-1 h-12 bg-white hover:bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center border border-gray-200 hover:border-gray-400 transition-all duration-300'>
                {copied
                  ? <svg viewBox='0 0 24 24' className='w-5 h-5 stroke-green-500 fill-none' strokeWidth='2.5'><polyline points='20 6 9 17 4 12'/></svg>
                  : <svg viewBox='0 0 24 24' className='w-5 h-5 stroke-gray-600 fill-none' strokeWidth='2'><path d='M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8'/><polyline points='16 6 12 2 8 6'/><line x1='12' y1='2' x2='12' y2='15'/></svg>
                }
              </motion.button>
            </div>

            <div className='grid grid-cols-3 gap-2 mt-6'>
              {[['🔒', 'Secure Pay'], ['🚚', 'Fast Ship'], ['↩️', '7-Day Return']].map(([icon, text]) => (
                <div key={text} className='bg-gray-50 rounded-xl p-3 text-center border border-gray-100'>
                  <div className='text-lg mb-1'>{icon}</div>
                  <div className='text-gray-500 text-[10px] tracking-wider'>{text}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {productData.description && (
          <div className='mt-14 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm'>
            <p className='text-xs tracking-widest uppercase text-gray-900 font-semibold mb-3'>Description</p>
            {/<[a-z][\s\S]*>/i.test(productData.description)
              ? <div className='text-gray-600 text-sm leading-relaxed font-light' dangerouslySetInnerHTML={{ __html: productData.description }} />
              : <p className='text-gray-600 text-sm leading-relaxed font-light whitespace-pre-line'>{productData.description}</p>}
          </div>
        )}

        {moreFromRack.length > 0 && (
          <div className='mt-16 -mx-4 sm:-mx-6 bg-[#f5f2ed] pt-8 rounded-3xl'>
            <h2 className='px-6 sm:px-10 font-serif text-2xl font-light text-gray-900'>More from the {RACKS[kind].title} rack</h2>
            <HangerRail products={moreFromRack} railId='related' />
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default Product

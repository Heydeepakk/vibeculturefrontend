import React from 'react'
import { Helmet } from 'react-helmet-async'
import WardrobeShowcase from '../components/wardrobe/WardrobeShowcase'

const Home = () => {
  return (
    <div>
      <Helmet>
        <title>VibeCulture | Premium T-Shirts, Lowers, Jeans & Underwear for Men</title>
        <meta name="description" content="Shop premium men's T-shirts, lowers, jeans and underwear at VibeCulture. Browse the wardrobe, turn each piece round and pick it off the rack. Fast delivery across India." />
        <link rel="canonical" href="https://www.vibeculture.in/" />
      </Helmet>
      <WardrobeShowcase />
    </div>
  )
}

export default Home

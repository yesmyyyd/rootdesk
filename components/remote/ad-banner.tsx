"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"

interface AdItem {
  imageUrl: string
  clickUrl: string
}

export function AdBanner() {
  const [ads, setAds] = useState<AdItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const response = await fetch("/ad.json")
        if (!response.ok) throw new Error("Failed to fetch ads")
        const data = await response.json()
        if (data && Array.isArray(data.remote) && data.remote.length > 0) {
          // Only update if the ads have actually changed
          setAds(prevAds => {
            if (JSON.stringify(prevAds) === JSON.stringify(data.remote)) {
              return prevAds
            }
            return data.remote
          })
          setIsVisible(true)
        } else {
          setIsVisible(false)
        }
      } catch (error) {
        console.error("Ad error:", error)
        setIsVisible(false)
      }
    }

    fetchAds()
  }, [])

  useEffect(() => {
    if (ads.length <= 1) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length)
    }, 5000) // Rotate every 5 seconds

    return () => clearInterval(timer)
  }, [ads])

  if (!isVisible || ads.length === 0) return null

  const currentAd = ads[currentIndex]

  const handleClick = () => {
    if (currentAd.clickUrl && currentAd.clickUrl !== "#") {
      window.open(currentAd.clickUrl, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div className="w-full px-4 pb-4">
      <div 
        className="relative w-full aspect-[16/10] rounded-xl overflow-hidden border border-border bg-muted/30 cursor-pointer group shadow-sm"
        onClick={handleClick}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <Image
              src={currentAd.imageUrl}
              alt={`Advertisement ${currentIndex + 1}`}
              fill
              className="object-contain transition-transform duration-500 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </AnimatePresence>
        
        {/* Indicators */}
        {ads.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {ads.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? "w-4 bg-primary" : "w-1 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

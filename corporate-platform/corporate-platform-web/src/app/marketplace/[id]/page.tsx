'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Shield,
  ShoppingCart,
  TrendingUp,
  Globe,
  Layers,
  Tag,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useCorporate } from '@/contexts/CorporateContext'
import { marketplaceService } from '@/services/marketplace.service'
import { MarketplaceCredit } from '@/types/marketplace'
import CreditCard from '@/components/marketplace/CreditCard'

export default function CreditDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { addToCart, cart } = useCorporate()

  const creditId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''

  const [credit, setCredit] = useState<MarketplaceCredit | null>(null)
  const [similar, setSimilar] = useState<MarketplaceCredit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addedToCart, setAddedToCart] = useState(false)

  useEffect(() => {
    if (!creditId) return

    const loadCredit = async () => {
      setLoading(true)
      setError(null)

      const [creditRes, similarRes] = await Promise.all([
        marketplaceService.getCreditById(creditId),
        marketplaceService.getSimilarCredits(creditId),
      ])

      if (creditRes.success && creditRes.data) {
        setCredit(creditRes.data)
      } else {
        setError(creditRes.error || 'Credit not found')
      }

      if (similarRes.success && similarRes.data) {
        setSimilar(similarRes.data.slice(0, 3))
      }

      setLoading(false)
    }

    loadCredit()
  }, [creditId])

  const isInCart = cart.some((item: any) => item.id === creditId)

  const handleAddToCart = () => {
    if (credit) {
      addToCart(credit as any)
      setAddedToCart(true)
      setTimeout(() => setAddedToCart(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 size={48} className="text-corporate-blue animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading credit details…</p>
        </div>
      </div>
    )
  }

  if (error || !credit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle size={48} className="text-red-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {error || 'Credit not found'}
        </h2>
        <Link href="/marketplace" className="corporate-btn-secondary px-4 py-2">
          ← Back to Marketplace
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/marketplace" className="flex items-center gap-1 hover:text-corporate-blue transition-colors">
          <ArrowLeft size={16} />
          Marketplace
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white truncate max-w-xs">{credit.projectName}</span>
      </div>

      {/* Hero Section */}
      <div className="bg-linear-to-br from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  credit.status === 'available'
                    ? 'bg-green-400/20 text-green-200 border border-green-400/30'
                    : 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/30'
                }`}
              >
                {credit.status.toUpperCase()}
              </span>
              {credit.featured && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-400/20 text-yellow-200 border border-yellow-400/30">
                  ⭐ Featured
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold mb-4">{credit.projectName}</h1>

            <div className="flex flex-wrap items-center gap-4 text-blue-100">
              {credit.country && (
                <span className="flex items-center gap-1">
                  <MapPin size={16} />
                  {credit.country}
                </span>
              )}
              {credit.vintage && (
                <span className="flex items-center gap-1">
                  <Calendar size={16} />
                  Vintage {credit.vintage}
                </span>
              )}
              {credit.verificationStandard && (
                <span className="flex items-center gap-1">
                  <Shield size={16} />
                  {credit.verificationStandard}
                </span>
              )}
              {credit.methodology && (
                <span className="flex items-center gap-1">
                  <Layers size={16} />
                  {credit.methodology}
                </span>
              )}
            </div>
          </div>

          {/* Purchase Box */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 min-w-64">
            <div className="text-blue-200 text-sm mb-1">Price per tonne</div>
            <div className="text-4xl font-bold mb-1">${credit.pricePerTon}</div>
            <div className="text-blue-300 text-sm mb-4">
              {credit.availableAmount.toLocaleString()} tCO₂ available
            </div>

            <button
              onClick={handleAddToCart}
              disabled={credit.status !== 'available' || isInCart}
              className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                isInCart || addedToCart
                  ? 'bg-green-500 text-white'
                  : credit.status !== 'available'
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-white text-corporate-navy hover:bg-blue-50'
              }`}
            >
              <ShoppingCart size={20} />
              {addedToCart ? 'Added!' : isInCart ? 'In Cart' : 'Add to Cart'}
            </button>

            {isInCart && (
              <p className="text-center text-blue-200 text-xs mt-2">
                Already in your cart
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Quality Metrics */}
        <div className="corporate-card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-corporate-blue" />
            Quality Score
          </h3>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
                  credit.dynamicScore >= 90
                    ? 'bg-green-500'
                    : credit.dynamicScore >= 70
                    ? 'bg-blue-500'
                    : 'bg-yellow-500'
                }`}
                style={{ width: `${Math.min(credit.dynamicScore, 100)}%` }}
              />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {credit.dynamicScore}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Dynamic quality rating</p>
        </div>

        {/* Credit Info */}
        <div className="corporate-card p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Globe size={18} className="text-corporate-blue" />
            Credit Information
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Total Amount</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {credit.totalAmount.toLocaleString()} tCO₂
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Available</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {credit.availableAmount.toLocaleString()} tCO₂
              </dd>
            </div>
            {credit.lastVerification && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Last Verified</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {new Date(credit.lastVerification).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* SDGs */}
        {credit.sdgs && credit.sdgs.length > 0 && (
          <div className="corporate-card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Tag size={18} className="text-corporate-blue" />
              SDG Impact
            </h3>
            <div className="flex flex-wrap gap-2">
              {credit.sdgs.map((sdg) => (
                <span
                  key={sdg}
                  className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-lg text-sm font-medium"
                >
                  SDG {sdg}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Co-Benefits */}
        {credit.coBenefits && credit.coBenefits.length > 0 && (
          <div className="corporate-card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Co-Benefits</h3>
            <div className="flex flex-wrap gap-2">
              {credit.coBenefits.map((benefit) => (
                <span
                  key={benefit}
                  className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-lg text-sm"
                >
                  {benefit}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Similar Credits */}
      {similar.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Similar Credits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {similar.map((c) => (
              <CreditCard key={c.id} credit={c as any} viewMode="grid" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

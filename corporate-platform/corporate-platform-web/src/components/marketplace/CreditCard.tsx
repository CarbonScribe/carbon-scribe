'use client'

import Link from 'next/link'
import { MapPin, Calendar, Shield, TrendingUp, ShoppingCart, Eye } from 'lucide-react'
import { CarbonCredit } from '@/types'
import { useCorporate } from '@/contexts/CorporateContext'

interface CreditCardProps {
  credit: CarbonCredit
  viewMode: 'grid' | 'list'
}

export default function CreditCard({ credit, viewMode }: CreditCardProps) {
  const { addToCart } = useCorporate()

  if (viewMode === 'grid') {
    return (
      <div className="corporate-card hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
        <div className="relative h-48 bg-linear-to-br from-blue-500/20 to-teal-500/20 rounded-t-xl overflow-hidden">
          <div className="absolute top-4 right-4">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              credit.status === 'available' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
            }`}>
              {credit.status.toUpperCase()}
            </div>
          </div>
          <div className="absolute bottom-4 left-4">
            <div className="text-2xl font-bold text-corporate-navy dark:text-white">
              ${credit.pricePerTon}/ton
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Starting from</div>
          </div>
        </div>
        
        <div className="p-5">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2">
            {credit.projectName}
          </h3>
          
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-4">
            <MapPin size={14} className="mr-1" />
            {credit.country}
            <Calendar size={14} className="ml-3 mr-1" />
            {credit.vintage}
            <Shield size={14} className="ml-3 mr-1" />
            {credit.verificationStandard}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Available</div>
              <div className="font-bold text-gray-900 dark:text-white">{credit.availableAmount.toLocaleString()} tCO₂</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Dynamic Score</div>
              <div className="flex items-center">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                  <div 
                    className={`h-2 rounded-full ${
                      credit.dynamicScore >= 90 ? 'bg-green-500' :
                      credit.dynamicScore >= 80 ? 'bg-blue-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${credit.dynamicScore}%` }}
                  ></div>
                </div>
                <span className="font-bold text-sm">{credit.dynamicScore}</span>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">SDG Impact</div>
            <div className="flex flex-wrap gap-1">
              {credit.sdgs.map((sdg: number) => (
                <span key={sdg} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                  {sdg}
                </span>
              ))}
            </div>
          </div>

          <div className="flex space-x-2">
            <Link
              href={`/marketplace/${credit.id}`}
              className="flex-1 corporate-btn-secondary text-sm px-3 py-2 flex items-center justify-center"
            >
              <Eye size={16} className="mr-1" />
              Details
            </Link>
            <button
              onClick={() => addToCart(credit)}
              className="flex-1 corporate-btn-primary text-sm px-3 py-2"
              disabled={credit.status !== 'available'}
            >
              <ShoppingCart size={16} className="mr-1" />
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    )
  }

  // List View
  return (
    <div className="corporate-card p-5 hover:shadow-lg transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="md:w-1/4">
          <div className="bg-linear-to-br from-blue-500/20 to-teal-500/20 rounded-xl p-4 h-full">
            <div className="text-2xl font-bold text-corporate-navy dark:text-white mb-1">
              ${credit.pricePerTon}/ton
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Price per ton</div>
          </div>
        </div>
        
        <div className="md:w-1/2">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              {credit.projectName}
            </h3>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              credit.status === 'available' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
            }`}>
              {credit.status.toUpperCase()}
            </div>
          </div>
          
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-3">
            <MapPin size={14} className="mr-1" />
            {credit.country}
            <Calendar size={14} className="ml-3 mr-1" />
            Vintage {credit.vintage}
            <Shield size={14} className="ml-3 mr-1" />
            {credit.verificationStandard}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Available</div>
              <div className="font-bold text-gray-900 dark:text-white">{credit.availableAmount.toLocaleString()} tCO₂</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Methodology</div>
              <div className="font-medium text-gray-900 dark:text-white text-sm">{credit.methodology}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Dynamic Score</div>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                  <div 
                    className={`h-2 rounded-full ${
                      credit.dynamicScore >= 90 ? 'bg-green-500' :
                      credit.dynamicScore >= 80 ? 'bg-blue-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${credit.dynamicScore}%` }}
                  ></div>
                </div>
                <span className="font-bold">{credit.dynamicScore}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">SDGs</div>
              <div className="flex space-x-1">
                {credit.sdgs.slice(0, 3).map((sdg: number) => (
                  <span key={sdg} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                    {sdg}
                  </span>
                ))}
                {credit.sdgs.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs">
                    +{credit.sdgs.length - 3}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="md:w-1/4">
          <div className="flex flex-col space-y-2">
            <Link
              href={`/marketplace/${credit.id}`}
              className="corporate-btn-secondary text-sm px-3 py-2 flex items-center justify-center"
            >
              <Eye size={16} className="mr-1" />
              View Details
            </Link>
            <button
              onClick={() => addToCart(credit)}
              className="corporate-btn-primary text-sm px-3 py-2"
              disabled={credit.status !== 'available'}
            >
              <ShoppingCart size={16} className="mr-1" />
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
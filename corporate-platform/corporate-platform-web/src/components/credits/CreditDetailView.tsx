'use client';

import { useState } from 'react';
import { ArrowLeft, MapPin, Calendar, DollarSign, CheckCircle, ExternalLink, Award, TrendingUp } from 'lucide-react';
import { useCreditDetail, useCreditQuality } from '@/hooks/useCredits';
import CreditQualityMetrics from './CreditQualityMetrics';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CreditDetailProps {
  creditId: string;
}

export default function CreditDetailView({ creditId }: CreditDetailProps) {
  const router = useRouter();
  const { data: credit, loading, error } = useCreditDetail(creditId);
  const { data: quality } = useCreditQuality(creditId);
  const [showQuality, setShowQuality] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  if (error || !credit) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Credit Not Found</h2>
        <p className="text-gray-600 mb-6">{error || 'The credit you\u2019re looking for doesn\u2019t exist.'}</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Credits
      </button>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">{credit.projectName}</h1>
        <div className="flex flex-wrap gap-4 text-sm opacity-90">
          {credit.country && (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {credit.country}
            </span>
          )}
          {credit.methodology && (
            <span>{credit.methodology}</span>
          )}
          {credit.vintage && (
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Vintage {credit.vintage}
            </span>
          )}
          <span className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            ${credit.pricePerTon}/ton
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-2">Available Credits</div>
          <div className="text-3xl font-bold text-green-600">
            {credit.availableAmount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            of {credit.totalAmount.toLocaleString()} total
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-2">Quality Score</div>
          <div className="text-3xl font-bold text-blue-600">
            {credit.dynamicScore?.toFixed(1) || 'N/A'}
          </div>
          <button
            onClick={() => setShowQuality(!showQuality)}
            className="text-sm text-blue-600 hover:text-blue-700 mt-2"
          >
            View Details →
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-2">Status</div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <span className="text-2xl font-semibold text-green-600">{credit.status}</span>
          </div>
        </div>
      </div>

      {/* Quality Metrics */}
      {showQuality && quality && (
        <CreditQualityMetrics quality={quality} />
      )}

      {/* Project Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Project Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {credit.description && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              <p className="text-gray-600">{credit.description}</p>
            </div>
          )}

          {credit.verificationStandard && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Verification Standard</h3>
              <p className="text-gray-600 flex items-center gap-2">
                <Award className="h-4 w-4 text-yellow-600" />
                {credit.verificationStandard}
              </p>
            </div>
          )}

          {credit.lastVerification && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Last Verified</h3>
              <p className="text-gray-600 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(credit.lastVerification).toLocaleDateString()}
              </p>
            </div>
          )}

          {credit.assetCode && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Asset Code</h3>
              <p className="text-gray-600 font-mono text-sm">{credit.assetCode}</p>
            </div>
          )}

          {credit.issuer && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Issuer</h3>
              <p className="text-gray-600">{credit.issuer}</p>
            </div>
          )}

          {credit.contractId && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Contract ID</h3>
              <p className="text-gray-600 font-mono text-sm">{credit.contractId}</p>
            </div>
          )}
        </div>
      </div>

      {/* SDGs */}
      {credit.sdgs && credit.sdgs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Sustainable Development Goals
          </h2>
          <div className="flex flex-wrap gap-3">
            {credit.sdgs.map((sdg) => (
              <div
                key={sdg}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg font-semibold text-sm"
              >
                SDG {sdg}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registry Link */}
      {credit.registryUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <a
            href={credit.registryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <ExternalLink className="h-4 w-4" />
            View on Registry
          </a>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 pt-4">
        <Link
          href={`/corporate/marketplace/cart?add=${credit.id}`}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-center transition-colors"
        >
          Add to Cart
        </Link>
        <Link
          href={`/corporate/marketplace/compare?credits=${credit.id}`}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
        >
          Compare
        </Link>
      </div>
    </div>
  );
}

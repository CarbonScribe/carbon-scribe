'use client'

import IpfsManager from '@/components/ipfs/IpfsManager'

export default function DocumentsPage() {
  return (
    <div className="space-y-6 animate-in">
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">IPFS Documents & Certificates</h1>
        <p className="text-blue-100 opacity-90 max-w-2xl">
          Manage decentralized files with secure uploads, batch operations, CID retrieval, and retirement certificate verification.
        </p>
      </div>
      <IpfsManager />
    </div>
  )
}

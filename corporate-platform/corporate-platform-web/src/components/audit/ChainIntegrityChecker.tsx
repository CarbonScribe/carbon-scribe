'use client';

import React, { useState } from 'react';
import { checkChainIntegrity, anchorAuditTrail } from '@/lib/api/audit.api';
import type { ChainIntegrityResult } from '@/types/audit.types';
import { Shield, ShieldCheck, ShieldX, Loader2, Link } from 'lucide-react';

export default function ChainIntegrityChecker() {
  const [checking, setChecking] = useState(false);
  const [anchoring, setAnchoring] = useState(false);
  const [result, setResult] = useState<ChainIntegrityResult | null>(null);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const data = await checkChainIntegrity();
      setResult(data);
    } catch (error) {
      console.error('Chain integrity check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleAnchor = async () => {
    setAnchoring(true);
    try {
      const response = await anchorAuditTrail();
      alert(`Successfully anchored to Stellar! TX: ${response.transactionHash}`);
    } catch (error) {
      console.error('Anchoring failed:', error);
      alert('Failed to anchor audit trail to blockchain');
    } finally {
      setAnchoring(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Link className="w-5 h-5" />
            Audit Chain Integrity
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Verify the cryptographic integrity of the entire audit trail
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleCheck}
          disabled={checking}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {checking ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Shield className="w-5 h-5" />
              Check Integrity
            </>
          )}
        </button>

        <button
          onClick={handleAnchor}
          disabled={anchoring}
          className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {anchoring ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Anchoring...
            </>
          ) : (
            <>
              <Link className="w-5 h-5" />
              Anchor to Blockchain
            </>
          )}
        </button>
      </div>

      {result && (
        <div className={`p-4 rounded-lg border ${
          result.isValid
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-start gap-3">
            {result.isValid ? (
              <ShieldCheck className="w-6 h-6 text-green-600 flex-shrink-0" />
            ) : (
              <ShieldX className="w-6 h-6 text-red-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h4 className="font-semibold mb-2">
                {result.isValid ? 'Chain Integrity Verified' : 'Chain Integrity Compromised'}
              </h4>
              <p className="text-sm mb-3">{result.message}</p>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Total Events</p>
                  <p className="font-semibold">{result.totalEvents}</p>
                </div>
                <div>
                  <p className="text-gray-500">Valid Events</p>
                  <p className="font-semibold text-green-600">{result.validEvents}</p>
                </div>
                <div>
                  <p className="text-gray-500">Invalid Events</p>
                  <p className="font-semibold text-red-600">{result.invalidEvents}</p>
                </div>
              </div>

              {result.brokenChains.length > 0 && (
                <div className="mt-4">
                  <h5 className="font-semibold text-sm mb-2">Broken Chains:</h5>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {result.brokenChains.map((broken, idx) => (
                      <div key={idx} className="text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded">
                        <p>Event: {broken.eventId}</p>
                        <p>Expected: {broken.expectedHash.substring(0, 16)}...</p>
                        <p>Actual: {broken.actualHash.substring(0, 16)}...</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-3">
                Checked at: {new Date(result.checkedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { verifyAuditEvent } from '@/lib/api/audit.api';
import type { AuditEvent, VerificationResult } from '@/types/audit.types';
import { formatDate, formatEventType, formatAction, formatHash } from '@/lib/utils/audit-formatters';
import { Shield, ShieldCheck, ShieldX, Loader2 } from 'lucide-react';

interface EventDetailsProps {
  event: AuditEvent;
  onClose: () => void;
}

export default function EventDetails({ event, onClose }: EventDetailsProps) {
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await verifyAuditEvent(event.id);
      setVerification(result);
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Audit Event Details</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Event Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Event ID</label>
              <p className="font-mono text-sm">{event.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Timestamp</label>
              <p className="text-sm">{formatDate(event.timestamp)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Event Type</label>
              <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm">
                {formatEventType(event.eventType)}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Action</label>
              <span className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-sm">
                {formatAction(event.action)}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Entity Type</label>
              <p className="text-sm">{event.entityType}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Entity ID</label>
              <p className="font-mono text-sm">{event.entityId}</p>
            </div>
          </div>

          {/* Hash Information */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold mb-4">Cryptographic Hashes</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Event Hash</label>
                <p className="font-mono text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
                  {event.hash}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Previous Hash</label>
                <p className="font-mono text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
                  {event.previousHash}
                </p>
              </div>
              {event.transactionHash && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Stellar Transaction</label>
                  <p className="font-mono text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
                    {event.transactionHash}
                  </p>
                </div>
              )}
              {event.blockNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Block Number</label>
                  <p className="text-sm">{event.blockNumber}</p>
                </div>
              )}
            </div>
          </div>

          {/* State Changes */}
          {((event.previousState !== undefined && event.previousState !== null) || (event.newState !== undefined && event.newState !== null)) && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold mb-4">State Changes</h3>
              <div className="grid grid-cols-2 gap-4">
                {event.previousState !== undefined && event.previousState !== null && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Previous State</label>
                    <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-x-auto">
                      {String(JSON.stringify(event.previousState, null, 2))}
                    </pre>
                  </div>
                )}
                {event.newState !== undefined && event.newState !== null && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">New State</label>
                    <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-x-auto">
                      {String(JSON.stringify(event.newState, null, 2))}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Verification */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold mb-4">Integrity Verification</h3>
            
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Verify Event Integrity
                </>
              )}
            </button>

            {verification && (
              <div className={`mt-4 p-4 rounded-lg ${
                verification.isValid
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-start gap-3">
                  {verification.isValid ? (
                    <ShieldCheck className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : (
                    <ShieldX className="w-6 h-6 text-red-600 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">
                      {verification.isValid ? 'Verification Successful' : 'Verification Failed'}
                    </h4>
                    <p className="text-sm mb-2">{verification.message}</p>
                    <div className="text-xs space-y-1">
                      <p>Hash Match: {verification.hashMatch ? '✓' : '✗'}</p>
                      <p>Chain Valid: {verification.chainValid ? '✓' : '✗'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

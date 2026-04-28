'use client';

import React from 'react';
import AuditTrailViewer from '@/components/audit/AuditTrailViewer';
import ChainIntegrityChecker from '@/components/audit/ChainIntegrityChecker';
import { Shield, FileText, Link } from 'lucide-react';

export default function AuditTrailPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="w-8 h-8" />
            Audit Trail
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Immutable record of all platform actions with cryptographic verification
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Events</p>
              <p className="text-3xl font-bold mt-1">--</p>
            </div>
            <FileText className="w-12 h-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Chain Status</p>
              <p className="text-3xl font-bold mt-1">Valid</p>
            </div>
            <Shield className="w-12 h-12 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Blockchain Anchored</p>
              <p className="text-3xl font-bold mt-1">Yes</p>
            </div>
            <Link className="w-12 h-12 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Chain Integrity Checker */}
      <ChainIntegrityChecker />

      {/* Audit Trail Viewer */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-bold mb-4">Event Log</h2>
        <AuditTrailViewer />
      </div>
    </div>
  );
}

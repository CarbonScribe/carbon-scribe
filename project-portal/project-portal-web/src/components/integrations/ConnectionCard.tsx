'use client';

import { Link, MoreVertical, Play, Pause, Trash2, Settings } from 'lucide-react';
import { IntegrationConnection } from '@/store/integration.types';

interface ConnectionCardProps {
  connection: IntegrationConnection;
  onTest: (id: string) => void;
  onEdit: (connection: IntegrationConnection) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}

const ConnectionCard = ({ connection, onTest, onEdit, onDelete, onToggle }: ConnectionCardProps) => {
  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'stripe': return 'bg-purple-100 text-purple-800';
      case 'stellar': return 'bg-blue-100 text-blue-800';
      case 'sentinel': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
            <Link className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{connection.name}</h3>
            <p className="text-sm text-gray-600">{connection.environment}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs rounded-full ${getProviderColor(connection.provider)}`}>
            {connection.provider}
          </span>
          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(connection.status)}`}>
            {connection.status}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {connection.last_tested && (
            <span>Last tested: {new Date(connection.last_tested).toLocaleDateString()}</span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onTest(connection.id)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Test connection"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggle(connection.id, connection.status !== 'active')}
            className="p-1 text-gray-400 hover:text-green-600 transition-colors"
            title={connection.status === 'active' ? 'Deactivate' : 'Activate'}
          >
            {connection.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onEdit(connection)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit connection"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(connection.id)}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete connection"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionCard;

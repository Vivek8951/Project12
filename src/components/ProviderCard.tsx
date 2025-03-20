import React from 'react';
import { Database, CheckCircle, XCircle } from 'lucide-react';
import type { Provider } from '../types';

interface ProviderCardProps {
  provider: Provider;
  onSelect: (provider: Provider) => void;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({ provider, onSelect }) => {
  const usedStoragePercentage = (provider.usedStorage / provider.availableStorage) * 100;
  
  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${!provider.isOnline ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center">
          <Database className="w-6 h-6 text-blue-600 mr-2" />
          <div>
            <h3 className="font-mono text-sm">{provider.address.slice(0, 6)}...{provider.address.slice(-4)}</h3>
            <div className="flex items-center mt-1">
              {provider.isOnline ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">Online</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-500 mr-1" />
                  <span className="text-sm text-red-600">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-sm text-gray-500">Price per GB</span>
          <p className="font-semibold">{provider.pricePerGB} AAI</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Storage Usage</span>
            <span>{usedStoragePercentage.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600"
              style={{ width: `${usedStoragePercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-sm mt-1 text-gray-500">
            <span>{provider.usedStorage} GB used</span>
            <span>{provider.availableStorage} GB total</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500">Total Files</span>
            <p className="font-semibold">{provider.totalFiles}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Reputation</span>
            <p className="font-semibold">{provider.reputation} / 5.0</p>
          </div>
        </div>

        <button
          onClick={() => onSelect(provider)}
          disabled={!provider.isOnline}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Select Provider
        </button>
      </div>
    </div>
  );
};
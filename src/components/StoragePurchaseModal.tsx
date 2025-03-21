import React, { useState } from 'react';
import { X, Coins } from 'lucide-react';
import { ethers } from 'ethers';
import { StorageContract } from '../lib/contracts';
import { Provider } from '../types';

interface StoragePurchaseModalProps {
  provider: Provider;
  onClose: () => void;
  onPurchase: (amount: number) => Promise<void>;
}

export const StoragePurchaseModal: React.FC<StoragePurchaseModalProps> = ({ provider, onClose, onPurchase }) => {
  const [storageAmount, setStorageAmount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCost = storageAmount * provider.pricePerGB;
  const maxStorage = provider.availableStorage - provider.usedStorage;

  const handlePurchase = async () => {
    if (!provider.isOnline) {
      setError('Provider is currently offline. Please try again later.');
      return;
    }

    if (!window.ethereum) {
      setError('Please install MetaMask to purchase storage.');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const storageContract = new StorageContract(web3Provider);
      
      // Purchase storage through smart contract
      const receipt = await storageContract.purchaseStorage(
        provider.address,
        storageAmount,
        provider.pricePerGB
      );

      await onPurchase(storageAmount);
      onClose();
    } catch (error) {
      console.error('Purchase failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to complete purchase. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Purchase Storage</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {!provider.isOnline && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
            Warning: This provider is currently offline
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Storage Amount (GB)
            </label>
            <input
              type="number"
              min={1}
              max={maxStorage}
              value={storageAmount}
              onChange={(e) => setStorageAmount(Math.min(Math.max(1, parseInt(e.target.value) || 1), maxStorage))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Price per GB</span>
              <div className="flex items-center">
                <Coins className="w-4 h-4 text-yellow-500 mr-1" />
                <span>{provider.pricePerGB} AAI</span>
              </div>
            </div>
            <div className="flex justify-between items-center font-semibold">
              <span>Total Cost</span>
              <div className="flex items-center">
                <Coins className="w-5 h-5 text-yellow-500 mr-1" />
                <span>{totalCost} AAI</span>
              </div>
            </div>
          </div>

          <button
            onClick={handlePurchase}
            disabled={isLoading || storageAmount <= 0 || storageAmount > maxStorage || !provider.isOnline}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Purchase Storage'}
          </button>
        </div>
      </div>
    </div>
  );
};
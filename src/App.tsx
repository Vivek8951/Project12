import { useState, useEffect } from 'react';
import { Upload, Download, Database } from 'lucide-react';
import { ProviderCard } from './components/ProviderCard';
import { StoragePurchaseModal } from './components/StoragePurchaseModal';
import { WalletConnect } from './components/WalletConnect';
import { FileUpload } from './components/FileUpload';
import type { Provider } from './types';
import { supabase, TABLES } from './lib/supabase';

  const handleFileUpload = async (fileData: { name: string; size: number; ipfsCid: string }) => {
    try {
      const { error } = await supabase
        .from(TABLES.STORED_FILES)
        .insert([
          {
            name: fileData.name,
            size: fileData.size,
            ipfs_cid: fileData.ipfsCid,
            provider_id: selectedProvider?.id,
            client_address: walletAddress,
            uploaded_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;
      setShowUploadModal(false);
      fetchProviders(); // Refresh provider data
    } catch (err) {
      console.error('Error storing file metadata:', err);
    }
  };
  const [providers, setProviders] = useState<Provider[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProviders();
    const providerSubscription = supabase
      .channel('providers')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.PROVIDERS }, fetchProviders)
      .subscribe();

    return () => {
      providerSubscription.unsubscribe();
    };
  }, []);

  const fetchProviders = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from(TABLES.PROVIDERS)
        .select('*')
        .order('last_seen', { ascending: false });
      
      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mock data for development while loading
  const mockProviders: Provider[] = [
  {
    id: '1',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    availableStorage: 1000,
    usedStorage: 250,
    isOnline: true,
    pricePerGB: 10,
    totalFiles: 156,
    reputation: 4.8
  },
  {
    id: '2',
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    availableStorage: 2000,
    usedStorage: 800,
    isOnline: true,
    pricePerGB: 8,
    totalFiles: 342,
    reputation: 4.5
  }
];

  const handlePurchaseStorage = async (amount: number) => {
    if (!walletAddress) {
      console.error('Wallet not connected');
      return;
    }
    // TODO: Implement smart contract interaction for AAI token payment
    console.log(`Purchasing ${amount}GB from provider ${selectedProvider?.address} using wallet ${walletAddress}`);
  };

  const handleWalletConnect = (address: string) => {
    setWalletAddress(address);
  };

  const handleWalletDisconnect = () => {
    setWalletAddress(null);
    setSelectedProvider(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Database className="w-8 h-8 text-blue-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">Alpha AI DePIN</h1>
            </div>
            <div className="flex items-center space-x-4">
              <WalletConnect
                onConnect={handleWalletConnect}
                onDisconnect={handleWalletDisconnect}
              />
              {walletAddress && (
                <>
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </button>
                  <button 
                    className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {walletAddress ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Storage Providers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                <div className="col-span-3 text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading providers...</p>
                </div>
              ) : providers.length === 0 ? (
                <div className="col-span-3 text-center py-8">
                  <p className="text-gray-600">No storage providers available</p>
                </div>
              ) : providers.map(provider => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onSelect={setSelectedProvider}
                />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Network Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-600">Total Storage</h3>
                <p className="text-2xl font-bold text-blue-900">3,000 GB</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-600">Active Providers</h3>
                <p className="text-2xl font-bold text-green-900">{providers.filter(p => p.isOnline).length}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-purple-600">Total Files</h3>
                <p className="text-2xl font-bold text-purple-900">{providers.reduce((acc, p) => acc + p.totalFiles, 0)}</p>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-8">Please connect your wallet to access storage providers and manage your files.</p>
        </div>
      )}

      {showUploadModal && walletAddress && selectedProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Upload File</h2>
            <FileUpload
              providerId={selectedProvider.id}
              clientAddress={walletAddress}
              onUploadComplete={handleFileUpload}
            />
            <button
              onClick={() => setShowUploadModal(false)}
              className="mt-4 w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedProvider && walletAddress && (
        <StoragePurchaseModal
          provider={selectedProvider}
          onClose={() => setSelectedProvider(null)}
          onPurchase={handlePurchaseStorage}
        />
      )}
    </div>
  );
}

export default App;
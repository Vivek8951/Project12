import { useState, useEffect } from 'react';
import { Upload, Download, Database } from 'lucide-react';
import { ProviderCard } from './components/ProviderCard';
import { StoragePurchaseModal } from './components/StoragePurchaseModal';
import { WalletConnect } from './components/WalletConnect';
import { FileUpload } from './components/FileUpload';
import type { Provider } from './types';
import { supabase, TABLES } from './lib/supabase';

export default function App() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const handleFileUpload = async (fileData: { name: string; size: number; ipfsCid: string }) => {
    try {
      if (!selectedProvider || !walletAddress) {
        throw new Error('Provider or wallet not connected');
      }

      const { error } = await supabase
        .from(TABLES.STORED_FILES)
        .insert([
          {
            name: fileData.name,
            size: fileData.size,
            ipfs_cid: fileData.ipfsCid,
            provider_id: selectedProvider.id,
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

  const [lastLogTime, setLastLogTime] = useState<number>(0);

  useEffect(() => {
    // Fetch initial providers
    fetchProviders();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('providers')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'providers'
      }, (payload) => {
        setProviders(prevProviders => {
          const currentTime = Date.now();
          const hourInMs = 3600000; // 1 hour in milliseconds
          let shouldLog = false;
          
          // Only log if more than an hour has passed since the last log
          if (currentTime - lastLogTime >= hourInMs) {
            shouldLog = true;
            setLastLogTime(currentTime);
          }

          const updatedProviders = prevProviders.map(provider => {
            if (provider.address === payload.new.address) {
              // Log only once per hour for this provider
              if (shouldLog) {
                const storageUsed = parseFloat(payload.new.used_storage) || 0;
                console.log(`Provider status updated - Online: ${payload.new.is_online}, Storage Used: ${storageUsed}GB`);
              }
              
              return { 
                ...provider, 
                isOnline: payload.new.is_online,
                availableStorage: parseFloat(payload.new.available_storage) || 0,
                usedStorage: parseFloat(payload.new.used_storage) || 0,
                lastSeen: payload.new.last_seen
              };
            }
            return provider;
          });

          return updatedProviders;
        });
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [lastLogTime]);

  const fetchProviders = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from(TABLES.PROVIDERS)
        .select('*')
        .order('last_seen', { ascending: false });
      
      if (error) throw error;

      const currentTime = new Date().getTime();
      const mappedProviders = (data || []).map(provider => ({
        id: provider.id,
        address: provider.address,
        availableStorage: parseFloat(provider.available_storage),
        usedStorage: parseFloat(provider.used_storage),
        isOnline: provider.is_online,
        pricePerGB: parseFloat(provider.price_per_gb),
        totalFiles: provider.total_files,
        reputation: provider.reputation,
        lastSeen: provider.last_seen
      }));
      
      setProviders(mappedProviders);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
                </div>
              ) : providers.length > 0 ? (
                providers.map(provider => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    onSelect={() => setSelectedProvider(provider)}
                  />
                ))
              ) : (
                <div className="col-span-3 text-center py-8 text-gray-500">
                  No storage providers available
                </div>
              )}
            </div>
          </div>
        </main>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Connect your wallet to get started
          </h2>
          <p className="text-gray-500">
            You need to connect your wallet to upload files and purchase storage
          </p>
        </div>
      )}

      {selectedProvider && (
        <StoragePurchaseModal
          provider={selectedProvider}
          onClose={() => setSelectedProvider(null)}
          onPurchase={handlePurchaseStorage}
        />
      )}

      {showUploadModal && selectedProvider && (
        <FileUpload
          onClose={() => setShowUploadModal(false)}
          onUpload={handleFileUpload}
          provider={selectedProvider}
        />
      )}
    </div>
  );
}
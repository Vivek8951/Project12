import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
export const supabase = createClient(
  'https://bcrzplbyvjynicxptuix.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjcnpwbGJ5dmp5bmljeHB0dWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0NzA1OTIsImV4cCI6MjA1ODA0NjU5Mn0.Z-RtPx9DzUnZdagxU4FHZBLy6SwZLpeAuxlVxonTbjM'
);

// Database table names
export const TABLES = {
  PROVIDERS: 'providers',
  STORED_FILES: 'stored_files',
  STORAGE_TRANSACTIONS: 'storage_transactions',
  MINING_POINTS: 'mining_points'
};

// Provider-related operations
export const providerOperations = {
  async updateProviderStatus(providerId, isOnline) {
    const { data: existingProvider } = await supabase
      .from(TABLES.PROVIDERS)
      .select('*')
      .eq('address', providerId)
      .single();

    if (!existingProvider) {
      throw new Error('Provider not found');
    }

    const { data, error } = await supabase
      .from(TABLES.PROVIDERS)
      .upsert({
        address: providerId,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
        available_storage: existingProvider.available_storage,
        used_storage: existingProvider.used_storage,
        price_per_gb: existingProvider.price_per_gb,
        total_files: existingProvider.total_files,
        reputation: existingProvider.reputation
      }, {
        onConflict: 'address'
      });


    if (error) {
      console.error('Error updating provider status:', error);
      throw error;
    }
    return data;
  },

  async getAllProviders() {
    return await supabase
      .from(TABLES.PROVIDERS)
      .select('*')
      .order('last_seen', { ascending: false });
  }
};

// File-related operations
export const fileOperations = {
  async storeFile(fileData) {
    return await supabase
      .from(TABLES.STORED_FILES)
      .insert([
        {
          ...fileData,
          uploaded_at: new Date().toISOString()
        }
      ]);
  },

  async getFilesByClient(clientAddress) {
    return await supabase
      .from(TABLES.STORED_FILES)
      .select('*')
      .eq('client_address', clientAddress);
  }
};

// Transaction-related operations
export const transactionOperations = {
  async recordTransaction(transactionData) {
    return await supabase
      .from(TABLES.STORAGE_TRANSACTIONS)
      .insert([
        {
          ...transactionData,
          timestamp: new Date().toISOString()
        }
      ]);
  }
};

// Mining-related operations
export const miningOperations = {
  async updateMiningPoints(providerId, points) {
    return await supabase
      .from(TABLES.MINING_POINTS)
      .upsert({
        provider_id: providerId,
        points: points,
        last_updated: new Date().toISOString()
      });
  },

  async getMiningPoints(providerId) {
    return await supabase
      .from(TABLES.MINING_POINTS)
      .select('points')
      .eq('provider_id', providerId)
      .single();
  }
};
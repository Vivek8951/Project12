export interface Provider {
  id: string;
  address: string;
  availableStorage: number; // in GB
  usedStorage: number; // in GB
  isOnline: boolean;
  pricePerGB: number; // in AAI tokens
  totalFiles: number;
  reputation: number;
}

export interface StorageTransaction {
  id: string;
  providerId: string;
  clientAddress: string;
  storageAmount: number; // in GB
  transactionHash: string;
  timestamp: number;
}

export interface StoredFile {
  id: string;
  name: string;
  size: number;
  ipfsCid: string;
  providerId: string;
  clientAddress: string;
  uploadedAt: number;
  encryptionKey: string;
}
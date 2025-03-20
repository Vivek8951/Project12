-- Create tables for the Alpha AI DePIN storage system

-- Providers table to store information about storage providers
CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL UNIQUE,
    available_storage BIGINT NOT NULL,
    used_storage BIGINT NOT NULL DEFAULT 0,
    is_online BOOLEAN DEFAULT false,
    price_per_gb NUMERIC(10, 2) NOT NULL,
    total_files INTEGER DEFAULT 0,
    reputation NUMERIC(3, 2) DEFAULT 0,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stored files table to track files in the system
CREATE TABLE stored_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    size BIGINT NOT NULL,
    ipfs_cid TEXT NOT NULL,
    provider_id UUID REFERENCES providers(id),
    client_address TEXT NOT NULL,
    encryption_key TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage transactions to track payments and storage allocations
CREATE TABLE storage_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES providers(id),
    client_address TEXT NOT NULL,
    storage_amount BIGINT NOT NULL,
    transaction_hash TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mining points to track provider contributions
CREATE TABLE mining_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES providers(id),
    points BIGINT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_providers_address ON providers(address);
CREATE INDEX idx_stored_files_client ON stored_files(client_address);
CREATE INDEX idx_stored_files_provider ON stored_files(provider_id);
CREATE INDEX idx_transactions_provider ON storage_transactions(provider_id);
CREATE INDEX idx_mining_points_provider ON mining_points(provider_id);

-- Provider keys table to store encrypted private keys
CREATE TABLE provider_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES providers(id) UNIQUE,
    encrypted_private_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_provider_keys_provider ON provider_keys(provider_id);
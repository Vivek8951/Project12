import React, { useState, useCallback } from 'react';
import { Upload, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FileUploadProps {
  providerId: string;
  clientAddress: string;
  onUploadComplete: (fileData: { name: string; size: number; ipfsCid: string }) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ providerId, clientAddress, onUploadComplete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);

      // First, upload to IPFS through our backend
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file to IPFS');
      }

      const { ipfsCid } = await response.json();

      // Then store the file metadata in Supabase
      const { error: dbError } = await supabase
        .from('stored_files')
        .insert([
          {
            name: file.name,
            size: file.size,
            ipfs_cid: ipfsCid,
            provider_id: providerId,
            client_address: clientAddress,
            uploaded_at: new Date().toISOString()
          }
        ]);

      if (dbError) throw dbError;

      onUploadComplete({
        name: file.name,
        size: file.size,
        ipfsCid
      });
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`border-2 border-dashed rounded-lg p-8 text-center ${isUploading ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
      >
        <div className="flex flex-col items-center">
          {isUploading ? (
            <>
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="mt-2 text-sm text-gray-600">Uploading... {uploadProgress}%</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">Drag and drop a file here, or click to select</p>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                }}
              />
            </>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-2 text-sm text-red-600">{error}</div>
      )}
    </div>
  );
};
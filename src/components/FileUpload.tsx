import React, { useState, useCallback } from 'react';
import { Upload, Loader } from 'lucide-react';
import { supabase, TABLES } from '../lib/supabase';
import { create } from 'ipfs-http-client';

interface FileUploadProps {
  provider: { id: string; address: string };
  onClose: () => void;
  onUpload: (fileData: { name: string; size: number; ipfsCid: string }) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ provider, onClose, onUpload }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    try {
      // Check file size (max 1GB)
      const maxSize = 1024 * 1024 * 1024; // 1GB in bytes
      if (file.size > maxSize) {
        throw new Error('File size exceeds 1GB limit');
      }

      setIsUploading(true);
      setError(null);

      // Connect to local IPFS node
      const ipfs = create({ url: 'http://localhost:5001/api/v0' });

      // Upload file to IPFS with progress tracking
      const totalSize = file.size;
      let uploaded = 0;

      const fileAdded = await ipfs.add(
        file,
        {
          progress: (prog) => {
            uploaded = prog;
            const progress = Math.round((uploaded / totalSize) * 100);
            setUploadProgress(progress);
          }
        }
      );

      // Store file metadata in Supabase
      const { error: dbError } = await supabase
        .from(TABLES.STORED_FILES)
        .insert([
          {
            name: file.name,
            size: file.size / (1024 * 1024 * 1024), // Convert bytes to GB
            ipfs_cid: fileAdded.cid.toString(),
            provider_id: provider.id,
            provider_address: provider.address,
            uploaded_at: new Date().toISOString()
          }
        ]);

      if (dbError) throw dbError;

      onUpload({
        name: file.name,
        size: file.size,
        ipfsCid: fileAdded.cid.toString()
      });
      onClose();
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

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Upload File</h2>
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
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="*/*"
                />
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
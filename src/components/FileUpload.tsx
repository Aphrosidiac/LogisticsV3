'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, X, FileIcon, ImageIcon, Loader2 } from 'lucide-react';
import { uploadMultipleAttachments, formatFileSize, isImageFile } from '@/lib/storage';

interface FileUploadProps {
  orderId: string;
  imageOnly?: boolean;
  maxFiles?: number;
  onUploadComplete?: (urls: string[]) => void;
  onError?: (errors: string[]) => void;
  existingFiles?: string[];
  onRemoveFile?: (url: string) => void;
}

export default function FileUpload({
  orderId,
  imageOnly = false,
  maxFiles = 5,
  onUploadComplete,
  onError,
  existingFiles = [],
  onRemoveFile,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    // Check max files limit
    const totalFiles = existingFiles.length + selectedFiles.length + files.length;
    if (totalFiles > maxFiles) {
      if (onError) {
        onError([`Maximum ${maxFiles} files allowed`]);
      }
      return;
    }

    // Filter by type if image only
    const validFiles = imageOnly
      ? files.filter((f) => f.type.startsWith('image/'))
      : files;

    if (validFiles.length !== files.length) {
      if (onError) {
        onError(['Some files were skipped (only images allowed)']);
      }
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);

    try {
      const result = await uploadMultipleAttachments(orderId, selectedFiles, imageOnly);

      if (result.success && result.urls.length > 0) {
        if (onUploadComplete) {
          onUploadComplete(result.urls);
        }
        setSelectedFiles([]);
      }

      if (result.errors.length > 0 && onError) {
        onError(result.errors);
      }
    } catch (error: any) {
      if (onError) {
        onError([error.message || 'Upload failed']);
      }
    } finally {
      setUploading(false);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFilePicker}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={imageOnly ? 'image/*' : '*'}
          onChange={handleFileSelect}
        />

        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          {imageOnly ? 'Drop images here or click to browse' : 'Drop files here or click to browse'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Max {maxFiles} files, 10MB each
        </p>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Selected Files ({selectedFiles.length})</h4>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload
                </>
              )}
            </button>
          </div>

          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded border"
            >
              <div className="flex items-center gap-3">
                {isImageFile(file.name) ? (
                  <ImageIcon className="w-5 h-5 text-blue-500" />
                ) : (
                  <FileIcon className="w-5 h-5 text-gray-500" />
                )}
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                onClick={() => removeSelectedFile(index)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Existing Files */}
      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Uploaded Files ({existingFiles.length})</h4>
          {existingFiles.map((url, index) => {
            const fileName = url.split('/').pop() || 'file';
            const isImage = isImageFile(fileName);

            return (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-200"
              >
                <div className="flex items-center gap-3">
                  {isImage ? (
                    <img
                      src={url}
                      alt={fileName}
                      className="w-10 h-10 object-cover rounded"
                    />
                  ) : (
                    <FileIcon className="w-5 h-5 text-gray-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline"
                    >
                      View file
                    </a>
                  </div>
                </div>
                {onRemoveFile && (
                  <button
                    onClick={() => onRemoveFile(url)}
                    className="p-1 hover:bg-red-100 rounded text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { supabase, ORDER_ATTACHMENTS_BUCKET } from './supabase';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export interface FileUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface MultiFileUploadResult {
  success: boolean;
  urls: string[];
  errors: string[];
}

/**
 * Validate file before upload
 */
function validateFile(file: File, imageOnly: boolean = false): string | null {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
  }

  // Check file type
  const allowedTypes = imageOnly ? ALLOWED_IMAGE_TYPES : ALLOWED_FILE_TYPES;
  if (!allowedTypes.includes(file.type)) {
    return `File type not allowed: ${file.type}`;
  }

  return null;
}

/**
 * Generate unique file path for storage
 */
function generateFilePath(orderId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${orderId}/${timestamp}-${sanitizedName}`;
}

/**
 * Upload a single file to Supabase Storage
 */
export async function uploadOrderAttachment(
  orderId: string,
  file: File,
  imageOnly: boolean = false
): Promise<FileUploadResult> {
  try {
    // Validate file
    const validationError = validateFile(file, imageOnly);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Generate file path
    const filePath = generateFilePath(orderId, file.name);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(ORDER_ATTACHMENTS_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(ORDER_ATTACHMENTS_BUCKET)
      .getPublicUrl(filePath);

    return { success: true, url: urlData.publicUrl };
  } catch (error: any) {
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Upload multiple files at once
 */
export async function uploadMultipleAttachments(
  orderId: string,
  files: File[],
  imageOnly: boolean = false
): Promise<MultiFileUploadResult> {
  const urls: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = await uploadOrderAttachment(orderId, file, imageOnly);
    if (result.success && result.url) {
      urls.push(result.url);
    } else if (result.error) {
      errors.push(`${file.name}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    urls,
    errors,
  };
}

/**
 * Delete an attachment from storage
 */
export async function deleteAttachment(url: string): Promise<boolean> {
  try {
    // Extract file path from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split(`/${ORDER_ATTACHMENTS_BUCKET}/`);
    if (pathParts.length < 2) {
      console.error('Invalid file URL format');
      return false;
    }

    const filePath = pathParts[1];

    // Delete from Supabase Storage
    const { error } = await supabase.storage
      .from(ORDER_ATTACHMENTS_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return false;
  }
}

/**
 * Delete all attachments for an order
 */
export async function deleteOrderAttachments(orderId: string): Promise<boolean> {
  try {
    // List all files in the order's folder
    const { data: files, error: listError } = await supabase.storage
      .from(ORDER_ATTACHMENTS_BUCKET)
      .list(orderId);

    if (listError || !files || files.length === 0) {
      return true; // No files to delete
    }

    // Delete all files
    const filePaths = files.map((file) => `${orderId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from(ORDER_ATTACHMENTS_BUCKET)
      .remove(filePaths);

    if (deleteError) {
      console.error('Error deleting order attachments:', deleteError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting order attachments:', error);
    return false;
  }
}

/**
 * Upload a client attachment (images only)
 */
export async function uploadClientAttachment(
  clientId: string,
  file: File
): Promise<FileUploadResult> {
  try {
    const validationError = validateFile(file, true);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `clients/${clientId}/${timestamp}-${sanitizedName}`;

    const { error } = await supabase.storage
      .from(ORDER_ATTACHMENTS_BUCKET)
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from(ORDER_ATTACHMENTS_BUCKET)
      .getPublicUrl(filePath);

    return { success: true, url: urlData.publicUrl };
  } catch (error: any) {
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Delete all attachments for a client
 */
export async function deleteClientAttachments(clientId: string): Promise<boolean> {
  try {
    const { data: files, error: listError } = await supabase.storage
      .from(ORDER_ATTACHMENTS_BUCKET)
      .list(`clients/${clientId}`);

    if (listError || !files || files.length === 0) return true;

    const filePaths = files.map((file) => `clients/${clientId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from(ORDER_ATTACHMENTS_BUCKET)
      .remove(filePaths);

    if (deleteError) {
      console.error('Error deleting client attachments:', deleteError);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting client attachments:', error);
    return false;
  }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Check if file is an image
 */
export function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

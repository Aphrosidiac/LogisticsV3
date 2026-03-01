// Receipt Management System - Using localStorage for persistence
import { generateId } from './utils';

export interface ReceiptFile {
  id: string;
  sheet_id: string;
  row_index: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  file_content: string; // Store file content as base64
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

// Local storage key for receipts
const RECEIPTS_STORAGE_KEY = 'logistics_receipts';

/**
 * Get all receipts from localStorage
 */
function getStoredReceipts(): ReceiptFile[] {
  try {
    const stored = localStorage.getItem(RECEIPTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load receipts from localStorage:', error);
    return [];
  }
}

/**
 * Save receipts to localStorage
 */
function saveStoredReceipts(receipts: ReceiptFile[]): void {
  try {
    localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(receipts));
  } catch (error) {
    console.error('Failed to save receipts to localStorage:', error);
  }
}

/**
 * Convert file to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

/**
 * Convert base64 to blob URL
 */
function base64ToBlobUrl(base64: string, mimeType: string): string {
  // Extract the base64 data (remove data:image/png;base64, prefix)
  const base64Data = base64.split(',')[1];
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Upload a receipt file and save to localStorage
 */
export async function uploadReceipt(
  sheetId: string,
  rowIndex: number,
  file: File
): Promise<{ success: boolean; receipt?: ReceiptFile; error?: string }> {
  try {
    // Convert file to base64 for storage
    const fileContent = await fileToBase64(file);
    
    // Create receipt metadata
    const receipt: ReceiptFile = {
      id: generateId(),
      sheet_id: sheetId,
      row_index: rowIndex,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_url: '', // Will be created when needed
      file_content: fileContent,
      uploaded_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Get existing receipts and add new one
    const existingReceipts = getStoredReceipts();
    const updatedReceipts = [...existingReceipts, receipt];
    saveStoredReceipts(updatedReceipts);

    console.log('Receipt saved to localStorage:', receipt);
    return { success: true, receipt };
  } catch (error: any) {
    console.error('Upload receipt error:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

/**
 * Get all receipts for a specific sheet and row
 */
export async function getReceiptsForRow(
  sheetId: string,
  rowIndex: number
): Promise<{ success: boolean; receipts: ReceiptFile[]; error?: string }> {
  try {
    const allReceipts = getStoredReceipts();
    const filteredReceipts = allReceipts.filter(
      receipt => receipt.sheet_id === sheetId && receipt.row_index === rowIndex
    ).sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

    return { success: true, receipts: filteredReceipts };
  } catch (error: any) {
    console.error('Get receipts error:', error);
    return { success: false, receipts: [], error: error.message || 'Unknown error occurred' };
  }
}

/**
 * Delete a receipt
 */
export async function deleteReceipt(receiptId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const allReceipts = getStoredReceipts();
    const receiptToDelete = allReceipts.find(r => r.id === receiptId);
    
    if (!receiptToDelete) {
      return { success: false, error: 'Receipt not found' };
    }

    // Remove from storage
    const updatedReceipts = allReceipts.filter(r => r.id !== receiptId);
    saveStoredReceipts(updatedReceipts);

    return { success: true };
  } catch (error: any) {
    console.error('Delete receipt error:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

/**
 * Delete all receipts for a specific sheet and row
 */
export async function deleteReceiptsForRow(
  sheetId: string,
  rowIndex: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const allReceipts = getStoredReceipts();
    const updatedReceipts = allReceipts.filter(
      receipt => !(receipt.sheet_id === sheetId && receipt.row_index === rowIndex)
    );
    saveStoredReceipts(updatedReceipts);

    return { success: true };
  } catch (error: any) {
    console.error('Delete receipts for row error:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

/**
 * Get a blob URL for viewing a receipt
 */
export function getReceiptBlobUrl(receipt: ReceiptFile): string {
  try {
    return base64ToBlobUrl(receipt.file_content, receipt.file_type);
  } catch (error) {
    console.error('Failed to create blob URL for receipt:', error);
    return '';
  }
}

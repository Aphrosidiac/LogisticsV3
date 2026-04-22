// Completed Orders Management
import type { Order } from '@/types';

export interface CompletedOrder extends Order {
  completed_date: string;
  assigned_driver_id?: string;
  assigned_date?: string;
  completion_notes?: string;
  receipt_files?: ReceiptFile[];
}

export interface ReceiptFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
}

export interface CompletedOrderFilters {
  search: string;
  dateRange: {
    start: string;
    end: string;
  };
  zone: string;
  driver: string;
  status: string;
}

export interface CompletedOrderSort {
  field: 'completed_date' | 'date' | 'zone' | 'pallets' | 'delivery';
  direction: 'asc' | 'desc';
}

// Mock completed orders data for demonstration
export const mockCompletedOrders: CompletedOrder[] = [
  {
    id: 'comp-001',
    pallets: 8,
    zone: 'NORTH ZONE',
    zone_id: 'zone-1',
    district_id: 'dist-1',
    date: '2026-02-15',
    priority: 'high',
    do_number: 'DO-2024-001',
    pickup: 'Warehouse A',
    delivery: 'Kepong',
    invoice: 'INV-2024-001',
    status: 'completed',
    completed_date: '2026-02-15T14:30:00Z',
    assigned_driver_id: 'driver-1',
    assigned_date: '2026-02-15T08:00:00Z',
    completion_notes: 'Delivered successfully, customer satisfied',
    rawData: {},
  },
  {
    id: 'comp-002',
    pallets: 12,
    zone: 'SOUTH ZONE',
    zone_id: 'zone-2',
    district_id: 'dist-2',
    date: '2026-02-14',
    priority: 'standard',
    do_number: 'DO-2024-002',
    pickup: 'Warehouse B',
    delivery: 'Puchong',
    invoice: 'INV-2024-002',
    status: 'completed',
    completed_date: '2026-02-14T16:45:00Z',
    assigned_driver_id: 'driver-2',
    assigned_date: '2026-02-14T09:00:00Z',
    completion_notes: 'Partial delivery - 2 pallets returned',
    rawData: {},
  },
  {
    id: 'comp-003',
    pallets: 6,
    zone: 'EAST ZONE',
    zone_id: 'zone-3',
    district_id: 'dist-3',
    date: '2026-02-13',
    priority: 'high',
    do_number: 'DO-2024-003',
    pickup: 'Warehouse C',
    delivery: 'Kajang',
    invoice: 'INV-2024-003',
    status: 'completed',
    completed_date: '2026-02-13T12:15:00Z',
    assigned_driver_id: 'driver-3',
    assigned_date: '2026-02-13T07:30:00Z',
    completion_notes: 'Early delivery - customer requested morning slot',
    rawData: {},
  },
  {
    id: 'comp-004',
    pallets: 15,
    zone: 'WEST ZONE',
    zone_id: 'zone-4',
    district_id: 'dist-4',
    date: '2026-02-12',
    priority: 'standard',
    do_number: 'DO-2024-004',
    pickup: 'Warehouse D',
    delivery: 'Shah Alam',
    invoice: 'INV-2024-004',
    status: 'completed',
    completed_date: '2026-02-12T17:20:00Z',
    assigned_driver_id: 'driver-1',
    assigned_date: '2026-02-12T08:30:00Z',
    completion_notes: 'Full delivery completed',
    rawData: {},
  },
  {
    id: 'comp-005',
    pallets: 9,
    zone: 'NORTH ZONE',
    zone_id: 'zone-1',
    district_id: 'dist-5',
    date: '2026-02-11',
    priority: 'high',
    do_number: 'DO-2024-005',
    pickup: 'Warehouse A',
    delivery: 'Selayang',
    invoice: 'INV-2024-005',
    status: 'completed',
    completed_date: '2026-02-11T15:00:00Z',
    assigned_driver_id: 'driver-2',
    assigned_date: '2026-02-11T09:15:00Z',
    completion_notes: 'Customer provided positive feedback',
    rawData: {},
  },
];

// Mock driver assignments
export const mockDrivers = [
  { id: 'driver-1', name: 'Ahmad Rahman', identifier: 'DRV001' },
  { id: 'driver-2', name: 'Mohamed Ali', identifier: 'DRV002' },
  { id: 'driver-3', name: 'Siti Fatimah', identifier: 'DRV003' },
];

export async function getCompletedOrders(): Promise<CompletedOrder[]> {
  try {
    const { supabase, TABLES } = await import('./supabase');
    const { data, error } = await supabase
      .from(TABLES.ORDERS)
      .select('*')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((order: Record<string, unknown>) => ({
      id: order.id as string,
      zone: order.zone as string,
      date: order.date as string,
      pallets: order.pallets as number,
      priority: order.priority as 'high' | 'standard' | undefined,
      status: order.status as Order['status'],
      do_number: order.do_number as string | undefined,
      invoice_number: order.invoice_number as string | undefined,
      invoice: order.invoice_number as string | undefined,
      pickup: order.pickup as string | undefined,
      delivery: order.delivery as string | undefined,
      ctn_amount: order.ctn_amount as number | undefined,
      ctn_to_pallet_ratio: order.ctn_to_pallet_ratio as number | undefined,
      rawData: (order.raw_data || {}) as Record<string, string>,
      completed_date: order.updated_at as string,
      assigned_driver_id: (order.assigned_driver_id || undefined) as string | undefined,
      attachment_urls: (order.attachment_urls || []) as string[],
      receipt_files: [],
    }));
  } catch {
    return [];
  }
}

export function filterCompletedOrders(
  orders: CompletedOrder[],
  filters: CompletedOrderFilters
): CompletedOrder[] {
  return orders.filter((order) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        order.zone.toLowerCase().includes(searchLower) ||
        order.delivery?.toLowerCase().includes(searchLower) ||
        order.do_number?.toLowerCase().includes(searchLower) ||
        order.invoice?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Date range filter
    if (filters.dateRange.start && filters.dateRange.end) {
      const completedDate = new Date(order.completed_date);
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      
      if (completedDate < startDate || completedDate > endDate) {
        return false;
      }
    }

    // Zone filter
    if (filters.zone && order.zone !== filters.zone) {
      return false;
    }

    // Driver filter
    if (filters.driver && order.assigned_driver_id !== filters.driver) {
      return false;
    }

    return true;
  });
}

export function sortCompletedOrders(
  orders: CompletedOrder[],
  sort: CompletedOrderSort
): CompletedOrder[] {
  return [...orders].sort((a, b) => {
    let aValue: string | number | Date = a[sort.field] as string | number;
    let bValue: string | number | Date = b[sort.field] as string | number;

    // Handle date fields
    if (sort.field === 'completed_date' || sort.field === 'date') {
      aValue = new Date(aValue || 0);
      bValue = new Date(bValue || 0);
    }

    // Handle string comparison
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
    }
    if (typeof bValue === 'string') {
      bValue = bValue.toLowerCase();
    }

    let comparison = 0;
    if (aValue < bValue) {
      comparison = -1;
    } else if (aValue > bValue) {
      comparison = 1;
    }

    return sort.direction === 'desc' ? comparison * -1 : comparison;
  });
}

export function getCompletedOrderStats(orders: CompletedOrder[]) {
  const totalOrders = orders.length;
  const totalPallets = orders.reduce((sum, order) => sum + order.pallets, 0);
  
  const zoneStats = orders.reduce((acc, order) => {
    acc[order.zone] = (acc[order.zone] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const driverStats = orders.reduce((acc, order) => {
    if (order.assigned_driver_id) {
      acc[order.assigned_driver_id] = (acc[order.assigned_driver_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const recentOrders = orders
    .sort((a, b) => new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime())
    .slice(0, 5);

  return {
    totalOrders,
    totalPallets,
    zoneStats,
    driverStats,
    recentOrders,
  };
}

export function getDriverName(driverId: string): string {
  const driver = mockDrivers.find(d => d.id === driverId);
  return driver ? driver.name : 'Unknown Driver';
}

export function formatCompletedDate(dateString: string): string {
  const date = new Date(dateString);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

// Receipt upload functions
export function uploadReceipt(orderId: string, file: File): Promise<ReceiptFile> {
  return new Promise((resolve, reject) => {
    console.log('uploadReceipt called for order:', orderId, 'file:', file.name);
    
    // Validate file
    if (!file) {
      console.error('No file provided');
      reject(new Error('No file provided'));
      return;
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      console.error('File too large:', file.size);
      reject(new Error('File size exceeds 10MB limit'));
      return;
    }
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      console.error('Invalid file type:', file.type);
      reject(new Error('Invalid file type. Only images and PDFs are allowed'));
      return;
    }
    
    // Simulate file upload
    setTimeout(() => {
      try {
        const receiptFile: ReceiptFile = {
          id: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          url: URL.createObjectURL(file),
          type: file.type,
          size: file.size,
          uploaded_at: new Date().toISOString(),
        };
        console.log('Receipt file created:', receiptFile);
        resolve(receiptFile);
      } catch (error) {
        console.error('Error creating receipt file:', error);
        reject(error);
      }
    }, 1000);
  });
}

export function addReceiptToOrder(orderId: string, receipt: ReceiptFile): CompletedOrder[] {
  const updatedOrders = mockCompletedOrders.map(order => {
    if (order.id === orderId) {
      return {
        ...order,
        receipt_files: [...(order.receipt_files || []), receipt],
      };
    }
    return order;
  });
  
  // Update mock data
  mockCompletedOrders.splice(0, mockCompletedOrders.length, ...updatedOrders);
  return updatedOrders;
}

export function removeReceiptFromOrder(orderId: string, receiptId: string): CompletedOrder[] {
  const updatedOrders = mockCompletedOrders.map(order => {
    if (order.id === orderId) {
      return {
        ...order,
        receipt_files: order.receipt_files?.filter(receipt => receipt.id !== receiptId) || [],
      };
    }
    return order;
  });
  
  // Update mock data
  mockCompletedOrders.splice(0, mockCompletedOrders.length, ...updatedOrders);
  return updatedOrders;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

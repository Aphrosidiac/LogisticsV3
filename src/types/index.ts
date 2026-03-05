// Core data types for Logistics Distribution System

export interface Zone {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface District {
  id: string;
  zone_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ZoneWithDistricts extends Zone {
  districts: District[];
}

export interface Order {
  id: string;
  pallets: number;
  zone: string;        // Keep for backward compatibility
  zone_id?: string;    // New foreign key
  district_id?: string; // New foreign key
  date: string; // Required for date-based scheduling
  priority?: 'high' | 'standard';
  ctn_amount?: number;
  ctn_to_pallet_ratio?: number;
  do_number?: string;
  invoice_number?: string;
  pickup?: string;
  delivery?: string;
  invoice?: string;
  attachment_urls?: string[];
  status?: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'holding';
  completed_date?: string;
  assigned_driver_id?: string;
  assigned_date?: string;
  rawData: Record<string, string>;
}

export interface Driver {
  id: string;
  name: string;
  identifier: string;
  home_region?: string;
  max_capacity?: number; // Default 11 pallets
  phone?: string;        // WhatsApp phone number for driver dispatch
  is_active?: boolean;   // When false, driver is excluded from distribution
}

export interface ZoneGroup {
  zone: string;
  orders: Order[];
  totalPallets: number;
}

export interface DriverAssignment {
  driver: Driver;
  zones: string[];
  orders: Order[];
  totalPallets: number;
  totalOrders: number;
}

export interface DistributionResult {
  assignments: DriverAssignment[];
  unassignedDrivers: Driver[];
  pendingBalances?: PendingBalance[];
  summary: {
    totalOrders: number;
    totalPallets: number;
    totalZones: number;
    assignedDrivers: number;
    balancesCreated?: number;
  };
  timestamp: string;
  targetDate?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export interface Sheet {
  id: string;
  name: string;
  type: 'orders' | 'drivers';
  headers: string[];
  data: Record<string, any>[];
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppMessage {
  id: string;
  recipient: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string;
  error?: string;
  distributionId?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
}

// Pending Balance for partial fulfillments
export interface PendingBalance {
  id: string;
  original_order_id?: string;
  zone: string;
  zone_id?: string;
  district_id?: string;
  pickup?: string;
  delivery?: string;
  do_number?: string;
  original_quantity: number;
  fulfilled_quantity: number;
  remaining_quantity: number;
  original_date: string;
  scheduled_for_date: string;
  status: 'pending' | 'scheduled' | 'fulfilled' | 'cancelled';
  distribution_id?: string;
  fulfilled_by_order_id?: string;
  raw_data?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

// Field schema for flexible database configuration
export type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'file' | 'image';

export interface FieldSchema {
  id: string;
  name: string;  // Field name (e.g., "zone", "pallets", "customer")
  label: string; // Display label (e.g., "Zone", "Pallets", "Customer Name")
  type: FieldType;
  required: boolean;
  isUnitField?: boolean; // For orders: marks the quantity field used in distribution
  isCoreField?: boolean; // Cannot be deleted (zone, driver name, etc.)
  options?: string[]; // For dropdown type
  defaultValue?: any;
}

export interface TableSchema {
  id: string;
  name: string;
  type: 'orders' | 'drivers';
  fields: FieldSchema[];
  unitFieldId?: string; // ID of the field that represents quantity (for orders)
  unitName?: string; // Display name for unit (e.g., "pallets", "boxes", "kg")
  createdAt: string;
  updatedAt: string;
}

export interface AppConfig {
  id?: string;
  adminNumbers: string[];
  manualDrivers: Driver[];
  whatsappConnected: boolean;
  messageTemplates: MessageTemplate[];
  passwordHash?: string;
  schemas?: {
    orders?: TableSchema;
    drivers?: TableSchema;
  };
  distributionTime?: string;           // "HH:MM" e.g. "20:00"
  lastAutoDistributionDate?: string;   // YYYY-MM-DD
  autoMessageRecipients?: 'admins' | 'drivers' | 'both'; // Who receives WhatsApp after auto-distribution
}

export interface AppCache {
  orders: Order[];
  drivers: Driver[];
  zones: ZoneWithDistricts[];
  lastDistribution: DistributionResult | null;
  lastFetch: string | null;
}

export interface AppState {
  config: AppConfig;
  cache: AppCache;
  logs: LogEntry[];
  isAuthenticated: boolean;
}

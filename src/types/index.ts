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

export interface SpecialZone {
  id: string;
  name: string;
  description?: string;
  active_days: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
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
  measurement_unit?: 'CTN' | 'Roll' | 'Ft' | 'Bundle' | 'Others';
  is_oversized?: boolean;
  pallets_max?: number;
  do_number?: string;
  invoice_number?: string;
  pickup?: string;
  pickup_company?: string;
  pickup_address?: string;
  pickup_postcode?: string;
  pickup_area?: string;
  pickup_state?: string;
  pickup_phone?: string;
  delivery?: string;
  delivery_company?: string;
  delivery_address?: string;
  delivery_postcode?: string;
  delivery_area?: string;
  delivery_state?: string;
  delivery_phone?: string;
  invoice?: string;
  attachment_urls?: string[];
  status?: 'pending' | 'assigned' | 'picked_up' | 'in_progress' | 'completed' | 'cancelled';
  completed_date?: string;
  assigned_driver_id?: string;
  assigned_date?: string;
  pickup_verified?: boolean;
  pickup_verified_at?: string;
  pickup_verified_by?: string;
  delivery_photo_urls?: string[];
  delivered_at?: string;
  created_at?: string;
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
  isDelivered?: boolean;
}

export interface DistributionResult {
  id?: string;
  assignments: DriverAssignment[];
  unassignedDrivers: Driver[];
  skippedOrders?: Order[];
  summary: {
    totalOrders: number;
    totalPallets: number;
    totalZones: number;
    assignedDrivers: number;
    skippedOrders?: number;
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
  data: Record<string, unknown>[];
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
  defaultValue?: string | number | boolean;
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
  distributionPaused?: boolean;        // When true, auto-distribution is disabled
}

export interface Client {
  id: string;
  company_name: string;
  contact_person?: string;
  phone?: string;
  address?: string;
  postcode?: string;
  area?: string;
  state?: string;
  is_default_pickup?: boolean;
  delivery_locations: string[];
  notes?: string;
  date?: string;
  num_pallet?: number;
  num_ctn?: number;
  attachment_urls?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface AppCache {
  orders: Order[];
  drivers: Driver[];
  zones: ZoneWithDistricts[];
  specialZones: SpecialZone[];
  lastDistribution: DistributionResult | null;
  lastFetch: string | null;
}

export interface AppState {
  config: AppConfig;
  cache: AppCache;
  logs: LogEntry[];
  isAuthenticated: boolean;
}

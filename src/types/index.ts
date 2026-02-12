// Core data types for Logistics Distribution System

export interface Order {
  id: string;
  pallets: number;
  zone: string;
  date?: string;
  pickup?: string;
  delivery?: string;
  invoice?: string;
  rawData: Record<string, string>;
}

export interface Driver {
  id: string;
  name: string;
  identifier: string;
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
  summary: {
    totalOrders: number;
    totalPallets: number;
    totalZones: number;
    assignedDrivers: number;
  };
  timestamp: string;
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

// Field schema for flexible database configuration
export type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox';

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
  adminNumbers: string[];
  manualDrivers: Driver[];
  whatsappConnected: boolean;
  messageTemplates: MessageTemplate[];
  passwordHash?: string;
  schemas?: {
    orders?: TableSchema;
    drivers?: TableSchema;
  };
}

export interface AppCache {
  orders: Order[];
  drivers: Driver[];
  lastDistribution: DistributionResult | null;
  lastFetch: string | null;
}

export interface AppState {
  config: AppConfig;
  cache: AppCache;
  logs: LogEntry[];
  isAuthenticated: boolean;
}

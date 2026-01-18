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

export interface AppConfig {
  sheetsUrl: string;
  adminNumbers: string[];
  manualDrivers: Driver[];
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
}

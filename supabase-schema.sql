-- LogisticsV3 Supabase Database Schema
-- Copy and paste this entire file into the Supabase SQL Editor
-- Location: https://app.supabase.com/project/YOUR_PROJECT/sql/new

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_id UUID,
  zone TEXT NOT NULL,
  date DATE NOT NULL,
  priority TEXT DEFAULT 'standard' CHECK (priority IN ('high', 'standard')),
  ctn_amount NUMERIC,
  ctn_to_pallet_ratio NUMERIC,
  pallets NUMERIC NOT NULL,
  do_number TEXT,
  invoice_number TEXT,
  pickup TEXT,
  delivery TEXT,
  attachment_urls TEXT[],
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_zone ON orders(zone);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority);
CREATE INDEX IF NOT EXISTS idx_orders_sheet_id ON orders(sheet_id);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  identifier TEXT NOT NULL,
  home_region TEXT,
  max_capacity NUMERIC DEFAULT 11,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_home_region ON drivers(home_region);
CREATE INDEX IF NOT EXISTS idx_drivers_name ON drivers(name);

-- Sheets table
CREATE TABLE IF NOT EXISTS sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('orders', 'drivers')),
  headers TEXT[],
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sheets_type ON sheets(type);

-- Distributions table
CREATE TABLE IF NOT EXISTS distributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignments JSONB NOT NULL,
  summary JSONB NOT NULL,
  target_date DATE NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distributions_target_date ON distributions(target_date);

-- Pending Balances table
CREATE TABLE IF NOT EXISTS pending_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_order_id UUID,
  zone TEXT NOT NULL,
  pickup TEXT,
  delivery TEXT,
  do_number TEXT,
  original_quantity NUMERIC NOT NULL,
  fulfilled_quantity NUMERIC DEFAULT 0,
  remaining_quantity NUMERIC NOT NULL,
  original_date DATE NOT NULL,
  scheduled_for_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'fulfilled', 'cancelled')),
  distribution_id UUID,
  fulfilled_by_order_id UUID,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_balances_scheduled_date ON pending_balances(scheduled_for_date);
CREATE INDEX IF NOT EXISTS idx_pending_balances_status ON pending_balances(status);
CREATE INDEX IF NOT EXISTS idx_pending_balances_original_order ON pending_balances(original_order_id);

-- Schemas table
CREATE TABLE IF NOT EXISTS schemas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('orders', 'drivers')),
  fields JSONB NOT NULL,
  unit_field_id TEXT,
  unit_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schemas_type ON schemas(type);

-- App Config table
CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_numbers TEXT[],
  manual_drivers JSONB DEFAULT '[]'::jsonb,
  whatsapp_connected BOOLEAN DEFAULT false,
  message_templates JSONB DEFAULT '[]'::jsonb,
  password_hash TEXT,
  schemas JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'error', 'warning')),
  message TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);

-- WhatsApp Messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  distribution_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_distribution_id ON whatsapp_messages(distribution_id);

-- Zones table
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zones_name ON zones(name);
CREATE INDEX IF NOT EXISTS idx_zones_is_active ON zones(is_active);
CREATE INDEX IF NOT EXISTS idx_zones_display_order ON zones(display_order);

-- Districts table
CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(zone_id, name)
);

CREATE INDEX IF NOT EXISTS idx_districts_zone_id ON districts(zone_id);
CREATE INDEX IF NOT EXISTS idx_districts_name ON districts(name);
CREATE INDEX IF NOT EXISTS idx_districts_is_active ON districts(is_active);

-- Add zone_id and district_id to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_zone_id ON orders(zone_id);
CREATE INDEX IF NOT EXISTS idx_orders_district_id ON orders(district_id);

-- Add zone_id and district_id to pending_balances table
ALTER TABLE pending_balances ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id);
ALTER TABLE pending_balances ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts(id);

CREATE INDEX IF NOT EXISTS idx_pending_balances_zone_id ON pending_balances(zone_id);
CREATE INDEX IF NOT EXISTS idx_pending_balances_district_id ON pending_balances(district_id);

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- MIGRATIONS (run these if upgrading from an earlier schema)
-- ============================================================================

-- Add phone number to drivers (used by WhatsApp auto-dispatch)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add operational status to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
  CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled'));

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sheets_updated_at BEFORE UPDATE ON sheets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pending_balances_updated_at BEFORE UPDATE ON pending_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schemas_updated_at BEFORE UPDATE ON schemas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_config_updated_at BEFORE UPDATE ON app_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_messages_updated_at BEFORE UPDATE ON whatsapp_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_districts_updated_at BEFORE UPDATE ON districts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Clients table (pickup company directory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  address TEXT,
  postcode TEXT,
  area TEXT,
  state TEXT,
  is_default_pickup BOOLEAN DEFAULT false,
  delivery_locations TEXT[] DEFAULT '{}',
  notes TEXT,
  date DATE,
  num_pallet NUMERIC DEFAULT 0,
  num_ctn NUMERIC DEFAULT 0,
  attachment_urls TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_company_name ON clients(company_name);
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration: add pickup address fields to existing clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS postcode TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_default_pickup BOOLEAN DEFAULT false;

-- === Features Update (May 2026) ===
ALTER TABLE orders ADD COLUMN IF NOT EXISTS measurement_unit TEXT DEFAULT 'CTN';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_oversized BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_verified BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_verified_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_photo_urls TEXT[] DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_progress', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_orders_pickup_verified ON orders(pickup_verified);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

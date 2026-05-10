-- ============================================================================
-- Shuda Logistics V1 — Features Update (May 2026)
-- F2: Measurement unit, F3: Oversized flag, F4: Pickup verification, F5: POD
-- Run in Supabase SQL Editor
-- ============================================================================

-- Feature 2: Measurement unit for quantity
ALTER TABLE orders ADD COLUMN IF NOT EXISTS measurement_unit TEXT DEFAULT 'CTN';

-- Feature 3: Oversized/panjang flag
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_oversized BOOLEAN DEFAULT false;

-- Feature 4: Pickup verification
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_verified BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_verified_by TEXT;

-- Feature 5: Delivery proof photos
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_photo_urls TEXT[] DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

-- Update status CHECK to include 'picked_up'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_progress', 'completed', 'cancelled'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_pickup_verified ON orders(pickup_verified);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

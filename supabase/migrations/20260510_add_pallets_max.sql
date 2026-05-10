-- Add pallets_max column for range pallet counts (e.g., 5-6 pallets)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pallets_max INTEGER;

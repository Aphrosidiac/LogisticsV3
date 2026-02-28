-- Migration: Populate Placeholder Zones and Districts
-- Date: 2026-02-17
-- Description: Creates sample zones and districts for demonstration

-- Insert North Zone
INSERT INTO zones (name, description, is_active, display_order)
VALUES ('North Zone', 'Northern region deliveries', true, 1)
ON CONFLICT (name) DO NOTHING;

-- Insert South Zone
INSERT INTO zones (name, description, is_active, display_order)
VALUES ('South Zone', 'Southern region deliveries', true, 2)
ON CONFLICT (name) DO NOTHING;

-- Insert East Zone
INSERT INTO zones (name, description, is_active, display_order)
VALUES ('East Zone', 'Eastern region deliveries', true, 3)
ON CONFLICT (name) DO NOTHING;

-- Insert West Zone
INSERT INTO zones (name, description, is_active, display_order)
VALUES ('West Zone', 'Western region deliveries', true, 4)
ON CONFLICT (name) DO NOTHING;

-- Insert Districts for North Zone
INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Kepong', 'Kepong area', true, 1 FROM zones WHERE name = 'North Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Selayang', 'Selayang area', true, 2 FROM zones WHERE name = 'North Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Rawang', 'Rawang area', true, 3 FROM zones WHERE name = 'North Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Gombak', 'Gombak area', true, 4 FROM zones WHERE name = 'North Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

-- Insert Districts for South Zone
INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Cheras', 'Cheras area', true, 1 FROM zones WHERE name = 'South Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Puchong', 'Puchong area', true, 2 FROM zones WHERE name = 'South Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Seri Kembangan', 'Seri Kembangan area', true, 3 FROM zones WHERE name = 'South Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Kajang', 'Kajang area', true, 4 FROM zones WHERE name = 'South Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

-- Insert Districts for East Zone
INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Ampang', 'Ampang area', true, 1 FROM zones WHERE name = 'East Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Setapak', 'Setapak area', true, 2 FROM zones WHERE name = 'East Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Wangsa Maju', 'Wangsa Maju area', true, 3 FROM zones WHERE name = 'East Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

-- Insert Districts for West Zone
INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Petaling Jaya', 'PJ area', true, 1 FROM zones WHERE name = 'West Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Subang Jaya', 'Subang area', true, 2 FROM zones WHERE name = 'West Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Shah Alam', 'Shah Alam area', true, 3 FROM zones WHERE name = 'West Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

INSERT INTO districts (zone_id, name, description, is_active, display_order)
SELECT id, 'Klang', 'Klang area', true, 4 FROM zones WHERE name = 'West Zone'
ON CONFLICT (zone_id, name) DO NOTHING;

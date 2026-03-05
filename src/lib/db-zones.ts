import { supabase, TABLES } from './supabase';
import { Zone, District, ZoneWithDistricts } from '@/types';

// ============================================================================
// Zone Operations
// ============================================================================

/**
 * Get all zones, optionally filtered by active status
 */
export async function getAllZones(activeOnly = false): Promise<Zone[]> {
  try {
    let query = supabase
      .from(TABLES.ZONES)
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching zones:', error);
    return [];
  }
}

/**
 * Get a single zone by ID
 */
export async function getZone(id: string): Promise<Zone | null> {
  try {
    const { data, error } = await supabase
      .from(TABLES.ZONES)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching zone:', error);
    return null;
  }
}

/**
 * Get multiple zones by IDs in a single query
 */
export async function getZonesByIds(ids: string[]): Promise<Map<string, Zone>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  try {
    const { data, error } = await supabase
      .from(TABLES.ZONES)
      .select('*')
      .in('id', unique);

    if (error) throw error;
    return new Map((data || []).map(z => [z.id, z]));
  } catch (error) {
    console.error('Error fetching zones by ids:', error);
    return new Map();
  }
}

/**
 * Get multiple districts by IDs in a single query
 */
export async function getDistrictsByIds(ids: string[]): Promise<Map<string, District>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  try {
    const { data, error } = await supabase
      .from(TABLES.DISTRICTS)
      .select('*')
      .in('id', unique);

    if (error) throw error;
    return new Map((data || []).map(d => [d.id, d]));
  } catch (error) {
    console.error('Error fetching districts by ids:', error);
    return new Map();
  }
}

/**
 * Create a new zone
 */
export async function createZone(
  zone: Omit<Zone, 'id' | 'created_at' | 'updated_at'>
): Promise<Zone | null> {
  try {
    const { data, error } = await supabase
      .from(TABLES.ZONES)
      .insert(zone)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating zone:', error);
    return null;
  }
}

/**
 * Update a zone
 */
export async function updateZone(id: string, updates: Partial<Zone>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(TABLES.ZONES)
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating zone:', error);
    return false;
  }
}

/**
 * Delete a zone (checks for associated orders first)
 */
export async function deleteZone(id: string): Promise<boolean> {
  try {
    // Check if any orders reference this zone
    const { data: orders, error: ordersError } = await supabase
      .from(TABLES.ORDERS)
      .select('id')
      .eq('zone_id', id)
      .limit(1);

    if (ordersError) throw ordersError;

    if (orders && orders.length > 0) {
      throw new Error('Cannot delete zone: orders are associated with it');
    }

    // Delete the zone (cascade will delete districts)
    const { error } = await supabase
      .from(TABLES.ZONES)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting zone:', error);
    return false;
  }
}

// ============================================================================
// District Operations
// ============================================================================

/**
 * Get all districts for a specific zone
 */
export async function getDistrictsByZone(
  zoneId: string,
  activeOnly = false
): Promise<District[]> {
  try {
    let query = supabase
      .from(TABLES.DISTRICTS)
      .select('*')
      .eq('zone_id', zoneId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching districts:', error);
    return [];
  }
}

/**
 * Get all districts across all zones
 */
export async function getAllDistricts(activeOnly = false): Promise<District[]> {
  try {
    let query = supabase
      .from(TABLES.DISTRICTS)
      .select('*')
      .order('zone_id')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching all districts:', error);
    return [];
  }
}

/**
 * Get a single district by ID
 */
export async function getDistrict(id: string): Promise<District | null> {
  try {
    const { data, error } = await supabase
      .from(TABLES.DISTRICTS)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching district:', error);
    return null;
  }
}

/**
 * Create a new district
 */
export async function createDistrict(
  district: Omit<District, 'id' | 'created_at' | 'updated_at'>
): Promise<District | null> {
  try {
    const { data, error } = await supabase
      .from(TABLES.DISTRICTS)
      .insert(district)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating district:', error);
    return null;
  }
}

/**
 * Update a district
 */
export async function updateDistrict(id: string, updates: Partial<District>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(TABLES.DISTRICTS)
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating district:', error);
    return false;
  }
}

/**
 * Delete a district (checks for associated orders first)
 */
export async function deleteDistrict(id: string): Promise<boolean> {
  try {
    // Check if any orders reference this district
    const { data: orders, error: ordersError } = await supabase
      .from(TABLES.ORDERS)
      .select('id')
      .eq('district_id', id)
      .limit(1);

    if (ordersError) throw ordersError;

    if (orders && orders.length > 0) {
      throw new Error('Cannot delete district: orders are associated with it');
    }

    // Delete the district
    const { error } = await supabase
      .from(TABLES.DISTRICTS)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting district:', error);
    return false;
  }
}

// ============================================================================
// Combined Operations
// ============================================================================

/**
 * Get all zones with their nested districts
 */
export async function getZonesWithDistricts(activeOnly = false): Promise<ZoneWithDistricts[]> {
  try {
    const zones = await getAllZones(activeOnly);
    const allDistricts = await getAllDistricts(activeOnly);

    // Group districts by zone_id
    const districtsByZone = allDistricts.reduce((acc, district) => {
      if (!acc[district.zone_id]) {
        acc[district.zone_id] = [];
      }
      acc[district.zone_id].push(district);
      return acc;
    }, {} as Record<string, District[]>);

    // Combine zones with their districts
    return zones.map((zone) => ({
      ...zone,
      districts: districtsByZone[zone.id] || [],
    }));
  } catch (error) {
    console.error('Error fetching zones with districts:', error);
    return [];
  }
}

// ============================================================================
// Migration Helpers
// ============================================================================

/**
 * Get existing unique zone texts from orders table
 */
export async function getExistingZoneTexts(): Promise<Array<{ zone: string; count: number }>> {
  try {
    const { data, error } = await supabase
      .from(TABLES.ORDERS)
      .select('zone');

    if (error) throw error;

    // Count occurrences of each zone
    const zoneCounts: Record<string, number> = {};
    data?.forEach((order) => {
      if (order.zone) {
        zoneCounts[order.zone] = (zoneCounts[order.zone] || 0) + 1;
      }
    });

    return Object.entries(zoneCounts).map(([zone, count]) => ({ zone, count }));
  } catch (error) {
    console.error('Error fetching existing zone texts:', error);
    return [];
  }
}

/**
 * Create placeholder zones and districts for demonstration
 */
export async function createPlaceholderZones(): Promise<void> {
  try {
    // Define placeholder zones with districts
    const placeholderData = [
      {
        zone: {
          name: 'North Zone',
          description: 'Northern region deliveries',
          is_active: true,
          display_order: 1,
        },
        districts: [
          { name: 'Kepong', description: 'Kepong area', is_active: true, display_order: 1 },
          { name: 'Selayang', description: 'Selayang area', is_active: true, display_order: 2 },
          { name: 'Rawang', description: 'Rawang area', is_active: true, display_order: 3 },
          { name: 'Gombak', description: 'Gombak area', is_active: true, display_order: 4 },
        ],
      },
      {
        zone: {
          name: 'South Zone',
          description: 'Southern region deliveries',
          is_active: true,
          display_order: 2,
        },
        districts: [
          { name: 'Cheras', description: 'Cheras area', is_active: true, display_order: 1 },
          { name: 'Puchong', description: 'Puchong area', is_active: true, display_order: 2 },
          { name: 'Seri Kembangan', description: 'Seri Kembangan area', is_active: true, display_order: 3 },
          { name: 'Kajang', description: 'Kajang area', is_active: true, display_order: 4 },
        ],
      },
      {
        zone: {
          name: 'East Zone',
          description: 'Eastern region deliveries',
          is_active: true,
          display_order: 3,
        },
        districts: [
          { name: 'Ampang', description: 'Ampang area', is_active: true, display_order: 1 },
          { name: 'Setapak', description: 'Setapak area', is_active: true, display_order: 2 },
          { name: 'Wangsa Maju', description: 'Wangsa Maju area', is_active: true, display_order: 3 },
        ],
      },
      {
        zone: {
          name: 'West Zone',
          description: 'Western region deliveries',
          is_active: true,
          display_order: 4,
        },
        districts: [
          { name: 'Petaling Jaya', description: 'PJ area', is_active: true, display_order: 1 },
          { name: 'Subang Jaya', description: 'Subang area', is_active: true, display_order: 2 },
          { name: 'Shah Alam', description: 'Shah Alam area', is_active: true, display_order: 3 },
          { name: 'Klang', description: 'Klang area', is_active: true, display_order: 4 },
        ],
      },
    ];

    // Insert zones and districts
    for (const { zone: zoneData, districts } of placeholderData) {
      const createdZone = await createZone(zoneData);

      if (createdZone) {
        for (const districtData of districts) {
          await createDistrict({
            zone_id: createdZone.id,
            ...districtData,
          });
        }
      }
    }

    console.log('Placeholder zones and districts created successfully');
  } catch (error) {
    console.error('Error creating placeholder zones:', error);
    throw error;
  }
}

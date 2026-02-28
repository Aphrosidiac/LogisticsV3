// Mock zones data for demonstration purposes
import type { Zone, District, ZoneWithDistricts } from '@/types';

// Mock zones data
const mockZones: Zone[] = [
  {
    id: 'zone-1',
    name: 'North Zone',
    description: 'Northern delivery area',
    is_active: true,
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'zone-2',
    name: 'South Zone',
    description: 'Southern delivery area',
    is_active: true,
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'zone-3',
    name: 'East Zone',
    description: 'Eastern delivery area',
    is_active: true,
    display_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'zone-4',
    name: 'West Zone',
    description: 'Western delivery area',
    is_active: false,
    display_order: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock districts data
const mockDistricts: District[] = [
  // North Zone districts
  {
    id: 'district-1',
    zone_id: 'zone-1',
    name: 'Kepong',
    description: 'Kepong area',
    is_active: true,
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'district-2',
    zone_id: 'zone-1',
    name: 'Selayang',
    description: 'Selayang area',
    is_active: true,
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // South Zone districts
  {
    id: 'district-3',
    zone_id: 'zone-2',
    name: 'Puchong',
    description: 'Puchong area',
    is_active: true,
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'district-4',
    zone_id: 'zone-2',
    name: 'Seremban',
    description: 'Seremban area',
    is_active: true,
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // East Zone districts
  {
    id: 'district-5',
    zone_id: 'zone-3',
    name: 'Ampang',
    description: 'Ampang area',
    is_active: true,
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'district-6',
    zone_id: 'zone-3',
    name: 'Cheras',
    description: 'Cheras area',
    is_active: true,
    display_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // West Zone districts (inactive zone, but districts exist)
  {
    id: 'district-7',
    zone_id: 'zone-4',
    name: 'Subang',
    description: 'Subang area',
    is_active: false,
    display_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock functions that simulate database operations
export async function getAllZones(activeOnly = false): Promise<Zone[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return activeOnly ? mockZones.filter(z => z.is_active) : mockZones;
}

export async function getZone(id: string): Promise<Zone | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockZones.find(z => z.id === id) || null;
}

export async function createZone(zone: Omit<Zone, 'id' | 'created_at' | 'updated_at'>): Promise<Zone> {
  await new Promise(resolve => setTimeout(resolve, 800));
  const newZone: Zone = {
    ...zone,
    id: `zone-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockZones.push(newZone);
  return newZone;
}

export async function updateZone(id: string, updates: Partial<Zone>): Promise<Zone> {
  await new Promise(resolve => setTimeout(resolve, 600));
  const index = mockZones.findIndex(z => z.id === id);
  if (index === -1) throw new Error('Zone not found');
  
  mockZones[index] = {
    ...mockZones[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  return mockZones[index];
}

export async function deleteZone(id: string): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockZones.findIndex(z => z.id === id);
  if (index === -1) return false;
  
  // Also delete associated districts
  const districtIndex = mockDistricts.findIndex(d => d.zone_id === id);
  while (districtIndex !== -1) {
    mockDistricts.splice(districtIndex, 1);
  }
  
  mockZones.splice(index, 1);
  return true;
}

// District functions
export async function getAllDistricts(activeOnly = false): Promise<District[]> {
  await new Promise(resolve => setTimeout(resolve, 400));
  return activeOnly ? mockDistricts.filter(d => d.is_active) : mockDistricts;
}

export async function getDistrictsByZone(zoneId: string): Promise<District[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockDistricts.filter(d => d.zone_id === zoneId);
}

export async function createDistrict(district: Omit<District, 'id' | 'created_at' | 'updated_at'>): Promise<District> {
  await new Promise(resolve => setTimeout(resolve, 700));
  const newDistrict: District = {
    ...district,
    id: `district-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockDistricts.push(newDistrict);
  return newDistrict;
}

export async function updateDistrict(id: string, updates: Partial<District>): Promise<District> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockDistricts.findIndex(d => d.id === id);
  if (index === -1) throw new Error('District not found');
  
  mockDistricts[index] = {
    ...mockDistricts[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  return mockDistricts[index];
}

export async function deleteDistrict(id: string): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 400));
  const index = mockDistricts.findIndex(d => d.id === id);
  if (index === -1) return false;
  
  mockDistricts.splice(index, 1);
  return true;
}

export async function getZonesWithDistricts(activeOnly = false): Promise<ZoneWithDistricts[]> {
  await new Promise(resolve => setTimeout(resolve, 600));
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
}

// Mock pending balances data for demonstration purposes
import type { PendingBalance } from '@/types';

// Mock pending balances data
const mockBalances: PendingBalance[] = [
  {
    id: 'balance-1',
    original_order_id: 'order-1',
    zone: 'NORTH ZONE',
    zone_id: 'zone-1',
    district_id: 'district-1',
    pickup: 'Warehouse A',
    delivery: 'Kepong',
    do_number: 'DO-2024-001',
    original_quantity: 10,
    fulfilled_quantity: 7,
    remaining_quantity: 3,
    original_date: '2026-02-17',
    scheduled_for_date: '2026-02-18',
    status: 'pending',
    distribution_id: 'dist-1',
    raw_data: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'balance-2',
    original_order_id: 'order-2',
    zone: 'SOUTH ZONE',
    zone_id: 'zone-2',
    district_id: 'district-3',
    pickup: 'Warehouse B',
    delivery: 'Puchong',
    do_number: 'DO-2024-002',
    original_quantity: 15,
    fulfilled_quantity: 10,
    remaining_quantity: 5,
    original_date: '2026-02-17',
    scheduled_for_date: '2026-02-18',
    status: 'pending',
    distribution_id: 'dist-2',
    raw_data: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'balance-3',
    original_order_id: 'order-3',
    zone: 'EAST ZONE',
    zone_id: 'zone-3',
    district_id: 'district-5',
    pickup: 'Warehouse C',
    delivery: 'Ampang',
    do_number: 'DO-2024-003',
    original_quantity: 8,
    fulfilled_quantity: 8,
    remaining_quantity: 0,
    original_date: '2026-02-16',
    scheduled_for_date: '2026-02-17',
    status: 'fulfilled',
    distribution_id: 'dist-3',
    raw_data: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock functions that simulate database operations
export async function getAllPendingBalances(): Promise<PendingBalance[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 600));
  return mockBalances.filter(b => b.status === 'pending');
}

export async function getBalanceStatistics(): Promise<
  Array<{ date: string; count: number; totalQuantity: number; zones: string[] }>
> {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  // Group balances by date
  const stats = mockBalances.reduce((acc, balance) => {
    const date = balance.scheduled_for_date;
    if (!acc[date]) {
      acc[date] = {
        date,
        count: 0,
        totalQuantity: 0,
        zones: [],
      };
    }
    acc[date].count++;
    acc[date].totalQuantity += balance.remaining_quantity;
    if (!acc[date].zones.includes(balance.zone)) {
      acc[date].zones.push(balance.zone);
    }
    return acc;
  }, {} as Record<string, { date: string; count: number; totalQuantity: number; zones: string[] }>);

  return Object.values(stats).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getPendingBalancesForDate(date: string): Promise<PendingBalance[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockBalances.filter(b => b.scheduled_for_date === date && b.status === 'pending');
}

export async function createPendingBalance(
  orderId: string,
  remainingQty: number,
  scheduledDate: string,
  distributionId?: string
): Promise<{ success: boolean; balance?: PendingBalance; error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const newBalance: PendingBalance = {
    id: `balance-${Date.now()}`,
    original_order_id: orderId,
    zone: 'NORTH ZONE', // Mock zone
    zone_id: 'zone-1',
    district_id: 'district-1',
    pickup: 'Warehouse A',
    delivery: 'Kepong',
    do_number: `DO-${Date.now()}`,
    original_quantity: remainingQty + 5, // Mock original quantity
    fulfilled_quantity: 5,
    remaining_quantity: remainingQty,
    original_date: new Date().toISOString().split('T')[0],
    scheduled_for_date: scheduledDate,
    status: 'pending',
    distribution_id: distributionId,
    raw_data: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockBalances.push(newBalance);
  return { success: true, balance: newBalance };
}

export async function cancelBalance(balanceId: string): Promise<{ success: boolean; error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockBalances.findIndex(b => b.id === balanceId);
  if (index === -1) return { success: false, error: 'Balance not found' };

  mockBalances[index] = {
    ...mockBalances[index],
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  };

  return { success: true };
}

export async function rescheduleBalance(
  balanceId: string,
  newDate: string
): Promise<{ success: boolean; error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 600));
  const index = mockBalances.findIndex(b => b.id === balanceId);
  if (index === -1) return { success: false, error: 'Balance not found' };

  mockBalances[index] = {
    ...mockBalances[index],
    scheduled_for_date: newDate,
    updated_at: new Date().toISOString(),
  };

  return { success: true };
}

export async function batchCreateBalances(
  balances: Array<{
    orderId: string;
    remainingQty: number;
    scheduledDate: string;
    distributionId?: string;
  }>
): Promise<{ success: boolean; created: number; errors: string[] }> {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const errors: string[] = [];
  let created = 0;

  for (const balance of balances) {
    try {
      const result = await createPendingBalance(
        balance.orderId,
        balance.remainingQty,
        balance.scheduledDate,
        balance.distributionId
      );
      if (result.success) {
        created++;
      } else {
        errors.push(`Failed to create balance for order ${balance.orderId}: ${result.error}`);
      }
    } catch (error) {
      errors.push(`Error creating balance for order ${balance.orderId}: ${error}`);
    }
  }

  return { success: errors.length === 0, created, errors };
}

export async function convertBalancesToOrders(date: string): Promise<any[]> {
  await new Promise(resolve => setTimeout(resolve, 700));
  
  const dateBalances = await getPendingBalancesForDate(date);
  
  // Convert balances to order format
  return dateBalances.map(balance => ({
    id: `order-from-balance-${balance.id}`,
    zone: balance.zone,
    zone_id: balance.zone_id,
    district_id: balance.district_id,
    date: date,
    priority: 'high' as const,
    pallets: balance.remaining_quantity,
    pickup: balance.pickup,
    delivery: balance.delivery,
    do_number: balance.do_number,
    invoice: '',
    rawData: {
      ...balance.raw_data,
      _partial: 'true',
      _original_balance_id: balance.id,
    },
  }));
}

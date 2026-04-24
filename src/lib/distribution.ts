import { Order, Driver, DriverAssignment, DistributionResult } from '@/types';
import { shuffleArray, getLocalDate } from './utils';

interface DriverState {
  driver: Driver;
  remainingCapacity: number;
  zones: string[];
  orders: Order[];
  totalPallets: number;
  totalOrders: number;
}

function calculateTotalPallets(order: Order): number {
  let pallets = order.pallets || 0;
  if (order.ctn_amount && order.ctn_to_pallet_ratio && order.ctn_to_pallet_ratio > 0) {
    pallets += Math.ceil(order.ctn_amount / order.ctn_to_pallet_ratio);
  }
  return pallets;
}

/**
 * Find best driver for an order using zone affinity + random.
 * Priority: driver already serving this zone > random driver with capacity.
 */
function findBestDriver(
  zone: string,
  orderPallets: number,
  driverStates: DriverState[],
): DriverState | null {
  // 1. Prefer drivers already serving this zone who still have capacity
  const zoneDrivers = driverStates.filter(
    s => s.remainingCapacity >= orderPallets && s.zones.includes(zone)
  );
  if (zoneDrivers.length > 0) {
    return zoneDrivers[Math.floor(Math.random() * zoneDrivers.length)];
  }

  // 2. Fall back to any driver with capacity (already shuffled)
  const available = driverStates.filter(s => s.remainingCapacity >= orderPallets);
  if (available.length > 0) {
    return available[0];
  }

  return null;
}

export function getTomorrowDate(): string {
  const todayStr = getLocalDate();
  const d = new Date(todayStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return getLocalDate(d);
}

export function calculateDistribution(
  orders: Order[],
  drivers: Driver[],
  targetDate?: string
): DistributionResult {
  const distributionDate = targetDate || getTomorrowDate();

  if (orders.length === 0) throw new Error('No orders to distribute');
  if (drivers.length === 0) throw new Error('No drivers available');

  const filteredOrders = orders.filter((order) => order.date === distributionDate);
  if (filteredOrders.length === 0) throw new Error(`No orders scheduled for ${distributionDate}`);

  const ordersWithPallets = filteredOrders.map((order) => ({
    ...order,
    calculatedPallets: calculateTotalPallets(order),
  }));

  // Sort: high priority first, then FIFO
  ordersWithPallets.sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    const aTime = a.created_at || '';
    const bTime = b.created_at || '';
    return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
  });

  // Group orders by zone, preserving priority order within each zone
  const zoneOrderMap = new Map<string, typeof ordersWithPallets>();
  for (const order of ordersWithPallets) {
    if (!zoneOrderMap.has(order.zone)) zoneOrderMap.set(order.zone, []);
    zoneOrderMap.get(order.zone)!.push(order);
  }

  // Randomize zone processing order for fairness
  const zoneKeys = shuffleArray(Array.from(zoneOrderMap.keys()));

  // Initialize driver states in random order
  const driverStates: DriverState[] = shuffleArray(drivers).map(driver => ({
    driver,
    remainingCapacity: driver.max_capacity || 11,
    zones: [],
    orders: [],
    totalPallets: 0,
    totalOrders: 0,
  }));

  const skippedOrders: Order[] = [];

  // Assign zone by zone: each zone's orders go to the same driver when possible
  for (const zone of zoneKeys) {
    const zoneOrders = zoneOrderMap.get(zone)!;
    for (const order of zoneOrders) {
      const pallets = order.calculatedPallets;
      const best = findBestDriver(zone, pallets, driverStates);

      if (!best) {
        skippedOrders.push(order);
        continue;
      }

      best.orders.push(order);
      best.totalPallets += pallets;
      best.totalOrders += 1;
      best.remainingCapacity -= pallets;
      if (!best.zones.includes(zone)) best.zones.push(zone);
    }
  }

  const assignments: DriverAssignment[] = [];
  const unassignedDrivers: Driver[] = [];

  for (const state of driverStates) {
    if (state.orders.length > 0) {
      assignments.push({
        driver: state.driver,
        zones: state.zones,
        orders: state.orders,
        totalPallets: state.totalPallets,
        totalOrders: state.totalOrders,
      });
    } else {
      unassignedDrivers.push(state.driver);
    }
  }

  assignments.sort((a, b) => a.driver.name.localeCompare(b.driver.name));

  const allZones = new Set<string>();
  for (const assignment of assignments) {
    assignment.zones.forEach((z) => allZones.add(z));
  }

  return {
    assignments,
    unassignedDrivers,
    skippedOrders,
    summary: {
      totalOrders: filteredOrders.length,
      totalPallets: ordersWithPallets.reduce((sum, o) => sum + o.calculatedPallets, 0),
      totalZones: allZones.size,
      assignedDrivers: assignments.length,
      skippedOrders: skippedOrders.length,
    },
    timestamp: new Date().toISOString(),
    targetDate: distributionDate,
  };
}

/**
 * Format distribution message for WhatsApp
 */
export function formatDistributionMessage(result: DistributionResult): string {
  const lines: string[] = [];

  // Header
  lines.push('*LOGISTICS DISTRIBUTION REPORT*');
  lines.push('================================');
  lines.push(`Date: ${new Date(result.timestamp).toLocaleString('en-MY')}`);
  if (result.targetDate) {
    lines.push(`Delivery Date: ${result.targetDate}`);
  }
  lines.push('');

  // Driver assignments
  for (const assignment of result.assignments || []) {
    const capacity = assignment.driver.max_capacity || 11;
    const utilization = ((assignment.totalPallets / capacity) * 100).toFixed(0);

    lines.push(`*${assignment.driver.name}* (${assignment.driver.identifier})`);
    if (assignment.driver.home_region) {
      lines.push(`   Region: ${assignment.driver.home_region}`);
    }
    lines.push(`   Zones: ${(assignment.zones || []).join(', ')}`);
    lines.push(`   ${assignment.totalOrders} orders | ${assignment.totalPallets}/${capacity} pallets (${utilization}%)`);
    lines.push('');

    // Group orders by zone
    const ordersByZone = new Map<string, typeof assignment.orders>();
    for (const order of assignment.orders) {
      if (!ordersByZone.has(order.zone)) {
        ordersByZone.set(order.zone, []);
      }
      ordersByZone.get(order.zone)!.push(order);
    }

    for (const [zone, orders] of ordersByZone) {
      lines.push(`   Zone ${zone}:`);
      for (const order of orders) {
        const route = order.pickup && order.delivery
          ? `${order.pickup} -> ${order.delivery}`
          : order.delivery || order.pickup || 'N/A';

        const palletText = `${order.pallets} pallet${order.pallets > 1 ? 's' : ''}`;
        const doText = order.do_number ? ` [DO: ${order.do_number}]` : '';
        const priorityText = order.priority === 'high' ? ' [HIGH PRIORITY]' : '';
        const partialText = order.rawData?._partial === 'true' ? ' [PARTIAL]' : '';

        lines.push(`      - ${route} (${palletText})${doText}${priorityText}${partialText}`);
      }
    }
    lines.push('');
  }

  // Unassigned drivers
  if ((result.unassignedDrivers || []).length > 0) {
    lines.push('*Unassigned Drivers:*');
    for (const driver of result.unassignedDrivers || []) {
      lines.push(`   - ${driver.name}`);
    }
    lines.push('');
  }

  // Skipped orders (brief mention — detailed alert is a separate message)
  if (result.skippedOrders && result.skippedOrders.length > 0) {
    lines.push(`⚠️ *${result.skippedOrders.length} order(s) could not be assigned — see skipped orders alert.*`);
    lines.push('');
  }

  // Summary
  lines.push('================================');
  lines.push('*SUMMARY*');
  lines.push(`   - Total Orders: ${result.summary.totalOrders}`);
  lines.push(`   - Total Pallets: ${result.summary.totalPallets}`);
  lines.push(`   - Zones: ${result.summary.totalZones}`);
  lines.push(`   - Assigned Drivers: ${result.summary.assignedDrivers}`);
  if (result.summary.skippedOrders) {
    lines.push(`   - Skipped Orders: ${result.summary.skippedOrders}`);
  }
  lines.push('================================');

  return lines.join('\n');
}

/**
 * Format a message for a single driver's assignment (for individual WhatsApp dispatch)
 */
export function formatDriverAssignmentMessage(assignment: DriverAssignment): string {
  const lines: string[] = [];

  lines.push(`*Assignment for ${assignment.driver.name}*`);
  if (assignment.driver.identifier) {
    lines.push(`Vehicle: ${assignment.driver.identifier}`);
  }
  lines.push(`Zones: ${(assignment.zones || []).join(', ')}`);
  lines.push(`${assignment.totalOrders} order${assignment.totalOrders !== 1 ? 's' : ''} | ${assignment.totalPallets} pallet${assignment.totalPallets !== 1 ? 's' : ''}`);
  lines.push('');

  // Group orders by zone
  const ordersByZone = new Map<string, typeof assignment.orders>();
  for (const order of assignment.orders) {
    if (!ordersByZone.has(order.zone)) ordersByZone.set(order.zone, []);
    ordersByZone.get(order.zone)!.push(order);
  }

  for (const [zone, orders] of ordersByZone) {
    lines.push(`Zone ${zone}:`);
    for (const order of orders) {
      const route = order.pickup && order.delivery
        ? `${order.pickup} → ${order.delivery}`
        : order.delivery || order.pickup || 'N/A';
      const doText = order.do_number ? ` [DO: ${order.do_number}]` : '';
      const priorityText = order.priority === 'high' ? ' ⚠️ HIGH PRIORITY' : '';
      lines.push(`  • ${route} (${order.pallets} pallet${order.pallets > 1 ? 's' : ''})${doText}${priorityText}`);
    }
  }

  lines.push('');
  lines.push('_Please confirm receipt of this assignment._');

  return lines.join('\n');
}

/**
 * Format a separate WhatsApp alert for orders that couldn't be assigned
 */
export function formatSkippedOrdersMessage(skippedOrders: Order[]): string {
  const lines: string[] = [];

  lines.push('⚠️ *SKIPPED ORDERS — ACTION REQUIRED*');
  lines.push('================================');
  lines.push(`${skippedOrders.length} order${skippedOrders.length !== 1 ? 's' : ''} could not be assigned — no driver had enough capacity to take the full order.`);
  lines.push('These orders remain *pending* and require manual action.');
  lines.push('');

  for (const order of skippedOrders) {
    const route = order.pickup && order.delivery
      ? `${order.pickup} → ${order.delivery}`
      : order.delivery || order.pickup || 'N/A';
    const doText = order.do_number ? ` [DO: ${order.do_number}]` : '';
    const priorityText = order.priority === 'high' ? ' ⚠️ HIGH' : '';
    lines.push(`• Zone ${order.zone}: ${route} (${order.pallets} pallet${order.pallets !== 1 ? 's' : ''})${doText}${priorityText}`);
  }

  lines.push('================================');
  return lines.join('\n');
}

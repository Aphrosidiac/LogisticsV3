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

export function calculateTotalPallets(order: Order): number {
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

function palletRangeText(order: Order): string {
  const p = order.pallets || 0;
  if (order.pallets_max && order.pallets_max !== p) {
    return `${p}-${order.pallets_max} pallet${order.pallets_max > 1 ? 's' : ''}`;
  }
  return `${p} pallet${p !== 1 ? 's' : ''}`;
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

        const palletText = palletRangeText(order);
        const unitLabel = (order.measurement_unit || 'CTN').toLowerCase();
        const ctnText = order.ctn_amount ? ` + ${order.ctn_amount}${unitLabel}` : '';
        const doText = order.do_number ? ` [DO: ${order.do_number}]` : '';
        const priorityText = order.priority === 'high' ? ' [HIGH PRIORITY]' : '';
        const partialText = order.rawData?._partial === 'true' ? ' [PARTIAL]' : '';
        const oversizedText = order.is_oversized ? ' [PANJANG]' : '';

        lines.push(`      - ${route} (${palletText}${ctnText})${doText}${priorityText}${oversizedText}${partialText}`);
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
      const unitLabel = (order.measurement_unit || 'CTN').toLowerCase();
      const ctnText = order.ctn_amount ? ` + ${order.ctn_amount}${unitLabel}` : '';
      const doText = order.do_number ? ` [DO: ${order.do_number}]` : '';
      const priorityText = order.priority === 'high' ? ' ⚠️ HIGH PRIORITY' : '';
      const oversizedText = order.is_oversized ? ' 📏 PANJANG' : '';
      lines.push(`  • ${route} (${palletRangeText(order)}${ctnText})${doText}${priorityText}${oversizedText}`);
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
    const unitLabel = (order.measurement_unit || 'CTN').toLowerCase();
    const ctnText = order.ctn_amount ? ` + ${order.ctn_amount}${unitLabel}` : '';
    const doText = order.do_number ? ` [DO: ${order.do_number}]` : '';
    const priorityText = order.priority === 'high' ? ' ⚠️ HIGH' : '';
    lines.push(`• Zone ${order.zone}: ${route} (${palletRangeText(order)}${ctnText})${doText}${priorityText}`);
  }

  lines.push('================================');
  return lines.join('\n');
}

export function formatDriverPickupList(assignment: DriverAssignment): string {
  const lines: string[] = [];

  lines.push('☀️☀️☀️☀️☀️☀️☀️☀️☀️');

  const zoneName = assignment.zones.length > 0 ? assignment.zones[0] : 'KL';
  lines.push(`Ambil barang ${zoneName.toLowerCase()}`);

  // Group orders by pickup_company — track pallet-only and CTN orders separately
  const pickupMap = new Map<string, { basePallets: number; basePalletsMax: number; ctnTexts: string[]; isOversized: boolean; isHigh: boolean }>();

  for (const order of assignment.orders) {
    const company = order.pickup_company || order.pickup || 'Unknown';
    const existing = pickupMap.get(company) || { basePallets: 0, basePalletsMax: 0, ctnTexts: [], isOversized: false, isHigh: false };

    if (order.ctn_amount) {
      const unit = (order.measurement_unit || 'CTN').toLowerCase();
      if (order.ctn_to_pallet_ratio && order.ctn_to_pallet_ratio > 0) {
        const floor = Math.floor(order.ctn_amount / order.ctn_to_pallet_ratio);
        const ceil = Math.ceil(order.ctn_amount / order.ctn_to_pallet_ratio);
        existing.ctnTexts.push(floor !== ceil
          ? `${order.ctn_amount}${unit}(${floor}-${ceil})p`
          : `${order.ctn_amount}${unit}(${ceil})p`);
      } else {
        existing.ctnTexts.push(`${order.ctn_amount}${unit}`);
      }
    } else {
      existing.basePallets += order.pallets || 0;
      existing.basePalletsMax += order.pallets_max || order.pallets || 0;
    }

    if (order.is_oversized) existing.isOversized = true;
    if (order.priority === 'high') existing.isHigh = true;

    pickupMap.set(company, existing);
  }

  let index = 1;
  for (const [company, info] of pickupMap) {
    let line = `${index})${company.toLowerCase()} `;

    const parts: string[] = [];
    if (info.basePallets > 0) {
      parts.push(info.basePalletsMax !== info.basePallets
        ? `${info.basePallets}-${info.basePalletsMax}p`
        : `${info.basePallets}p`);
    }
    parts.push(...info.ctnTexts);

    line += parts.join('+') || '0p';

    if (info.isOversized) line += ' panjang';
    if (info.isHigh) line += '🚨🚨🚨';

    lines.push(line);
    index++;
  }

  return lines.join('\n');
}

export function formatPickupVerificationMessage(
  date: string,
  orders: Order[],
  verifiedMap: Map<string, boolean>,
): string {
  const lines: string[] = [];
  lines.push('COLLECT BY SHUDA');
  lines.push(`COLLECT DATE : ${date}`);

  // Group by delivery_company
  const byCompany = new Map<string, Order[]>();
  for (const order of orders) {
    const company = order.delivery_company || order.delivery || 'Unknown';
    if (!byCompany.has(company)) byCompany.set(company, []);
    byCompany.get(company)!.push(order);
  }

  let index = 1;
  for (const [company, companyOrders] of byCompany) {
    const doNumbers = companyOrders.map(o => {
      const verified = verifiedMap.get(o.id) ?? false;
      return `${o.do_number || 'N/A'}${verified ? '✅' : '❌'}`;
    }).join(', ');

    const quantityParts = companyOrders.map(o => {
      const unit = (o.measurement_unit || 'CTN').toUpperCase();
      const parts: string[] = [];
      if (o.pallets) {
        const palletText = o.pallets_max && o.pallets_max !== o.pallets
          ? `${o.pallets}-${o.pallets_max} PALLET`
          : `${o.pallets} PALLET`;
        parts.push(palletText);
      }
      if (o.ctn_amount) parts.push(`${o.ctn_amount} ${unit}`);
      return parts.join(' + ') || `${o.pallets} PALLET`;
    });

    lines.push(`${index}) ${company.toUpperCase()} (${doNumbers}) ${quantityParts.join(' + ')}`);
    index++;
  }

  return lines.join('\n');
}

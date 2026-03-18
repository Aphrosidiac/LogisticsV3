// Advanced distribution algorithm with capacity constraints, priority routing, and skip-on-overflow
// Supports date-based scheduling and region-based driver assignment

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

interface ScoredDriver {
  driver: Driver;
  state: DriverState;
  score: number;
}

/**
 * Calculate total pallets including CTN conversion
 */
function calculateTotalPallets(order: Order): number {
  let pallets = order.pallets || 0;

  // Add CTN conversion if applicable
  if (order.ctn_amount && order.ctn_to_pallet_ratio && order.ctn_to_pallet_ratio > 0) {
    const ctnPallets = Math.ceil(order.ctn_amount / order.ctn_to_pallet_ratio);
    pallets += ctnPallets;
  }

  return pallets;
}

/**
 * Extract zone prefix (e.g., "A" from "A-1", "A1", etc.)
 */
function getZonePrefix(zone: string): string {
  const match = zone.toUpperCase().match(/^([A-Z]+)/);
  return match ? match[1] : zone.toUpperCase();
}

/**
 * Calculate region score for driver assignment
 * 10 = exact match, 5 = adjacent/similar, 1 = other region
 */
function calculateRegionScore(driverRegion: string | undefined, zonePrefix: string): number {
  if (!driverRegion) return 1; // No home region = default score

  const driverPrefix = getZonePrefix(driverRegion);

  // Exact match
  if (driverPrefix === zonePrefix) return 10;

  // Adjacent/similar (e.g., A and B, or within same area)
  const driverChar = driverPrefix.charCodeAt(0);
  const zoneChar = zonePrefix.charCodeAt(0);
  if (Math.abs(driverChar - zoneChar) <= 1) return 5;

  // Other region
  return 1;
}

/**
 * Find best drivers for a given zone, considering region and capacity
 */
function findBestDrivers(
  zone: string,
  driverStates: Map<string, DriverState>,
  neededCapacity: number
): ScoredDriver[] {
  const zonePrefix = getZonePrefix(zone);
  const scoredDrivers: ScoredDriver[] = [];

  for (const state of driverStates.values()) {
    // Skip drivers with no remaining capacity
    if (state.remainingCapacity <= 0) continue;

    // Calculate region score
    const regionScore = calculateRegionScore(state.driver.home_region, zonePrefix);

    // Calculate capacity score (prefer drivers with more space)
    const capacityScore = state.remainingCapacity / (state.driver.max_capacity || 11);

    // Combined score: region is primary, capacity is tiebreaker
    const score = regionScore * 100 + capacityScore * 10;

    scoredDrivers.push({
      driver: state.driver,
      state,
      score,
    });
  }

  // Sort by score descending
  scoredDrivers.sort((a, b) => b.score - a.score);

  // Group by score and randomize within same score
  const scoreGroups = new Map<number, ScoredDriver[]>();
  for (const scored of scoredDrivers) {
    const roundedScore = Math.floor(scored.score / 10) * 10; // Group by tens
    if (!scoreGroups.has(roundedScore)) {
      scoreGroups.set(roundedScore, []);
    }
    scoreGroups.get(roundedScore)!.push(scored);
  }

  // Shuffle within each score group for variety
  const result: ScoredDriver[] = [];
  for (const group of Array.from(scoreGroups.values())) {
    result.push(...shuffleArray(group));
  }

  return result;
}

/**
 * Get tomorrow's date in YYYY-MM-DD format
 */
export function getTomorrowDate(): string {
  const todayStr = getLocalDate();           // YYYY-MM-DD in MY/SG time
  const d = new Date(todayStr + 'T12:00:00'); // noon avoids any DST edge cases
  d.setDate(d.getDate() + 1);
  return getLocalDate(d);
}

/**
 * Main distribution algorithm
 */
export function calculateDistribution(
  orders: Order[],
  drivers: Driver[],
  targetDate?: string
): DistributionResult {
  // Use tomorrow as default target date
  const distributionDate = targetDate || getTomorrowDate();

  // Validate inputs
  if (orders.length === 0) {
    throw new Error('No orders to distribute');
  }

  if (drivers.length === 0) {
    throw new Error('No drivers available');
  }

  // Filter orders for target date
  const filteredOrders = orders.filter((order) => order.date === distributionDate);

  if (filteredOrders.length === 0) {
    throw new Error(`No orders scheduled for ${distributionDate}`);
  }

  // Calculate total pallets for each order (including CTN conversion)
  const ordersWithPallets = filteredOrders.map((order) => ({
    ...order,
    calculatedPallets: calculateTotalPallets(order),
  }));

  // Sort by priority (high first), then FIFO (earliest created first)
  ordersWithPallets.sort((a, b) => {
    // Priority: high > standard
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;

    // Then by created_at ascending (FIFO — first in, first out)
    const aTime = a.created_at || '';
    const bTime = b.created_at || '';
    return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
  });

  // Initialize driver states
  const driverStates = new Map<string, DriverState>();
  for (const driver of drivers) {
    driverStates.set(driver.id, {
      driver,
      remainingCapacity: driver.max_capacity || 11,
      zones: [],
      orders: [],
      totalPallets: 0,
      totalOrders: 0,
    });
  }

  // Track skipped orders (can't be fully assigned to any driver)
  const skippedOrders: Order[] = [];

  // Assign orders to drivers
  for (const order of ordersWithPallets) {
    const orderPallets = order.calculatedPallets;

    // Find drivers with any remaining capacity
    const candidates = findBestDrivers(order.zone, driverStates, orderPallets);

    // Find a driver that can fit the FULL order (respecting region score priority)
    const fullFitCandidate = candidates.find(c => c.state.remainingCapacity >= orderPallets);

    if (!fullFitCandidate) {
      // No driver can fit the full order — skip it, leave as pending
      skippedOrders.push(order);
      continue;
    }

    const bestDriver = fullFitCandidate.state;
    bestDriver.orders.push(order);
    bestDriver.totalPallets += orderPallets;
    bestDriver.totalOrders += 1;
    bestDriver.remainingCapacity -= orderPallets;

    if (!bestDriver.zones.includes(order.zone)) {
      bestDriver.zones.push(order.zone);
    }
  }

  // Separate assigned and unassigned drivers
  const assignments: DriverAssignment[] = [];
  const unassignedDrivers: Driver[] = [];

  for (const state of driverStates.values()) {
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

  // Sort assignments by driver name
  assignments.sort((a, b) => a.driver.name.localeCompare(b.driver.name));

  // Calculate total zones
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

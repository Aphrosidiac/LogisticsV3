// Zone-based distribution algorithm with pallet load balancing

import { Order, Driver, ZoneGroup, DriverAssignment, DistributionResult } from '@/types';
import { shuffleArray } from './utils';

function groupOrdersByZone(orders: Order[]): ZoneGroup[] {
    const zoneMap = new Map<string, Order[]>();

    for (const order of orders) {
        const zone = order.zone.toUpperCase();
        if (!zoneMap.has(zone)) {
            zoneMap.set(zone, []);
        }
        zoneMap.get(zone)!.push(order);
    }

    // Convert to array and calculate totals
    const groups: ZoneGroup[] = Array.from(zoneMap.entries()).map(([zone, orders]) => ({
        zone,
        orders,
        totalPallets: orders.reduce((sum, o) => sum + o.pallets, 0),
    }));

    // Sort by pallet count descending (largest zones first for better balancing)
    return groups.sort((a, b) => b.totalPallets - a.totalPallets);
}

export function calculateDistribution(
    orders: Order[],
    drivers: Driver[]
): DistributionResult {
    if (orders.length === 0) {
        throw new Error('No orders to distribute');
    }

    if (drivers.length === 0) {
        throw new Error('No drivers available');
    }

    // Group orders by zone
    const zoneGroups = groupOrdersByZone(orders);

    // Shuffle drivers for random assignment
    const shuffledDrivers = shuffleArray(drivers);

    // Initialize driver assignments
    const driverAssignments: Map<string, DriverAssignment> = new Map();

    for (const driver of shuffledDrivers) {
        driverAssignments.set(driver.id, {
            driver,
            zones: [],
            orders: [],
            totalPallets: 0,
            totalOrders: 0,
        });
    }

    // Assign zones to drivers using greedy load balancing
    for (const zoneGroup of zoneGroups) {
        // Find driver with lowest current pallet count
        let minDriver: DriverAssignment | null = null;
        let minPallets = Infinity;

        for (const assignment of driverAssignments.values()) {
            if (assignment.totalPallets < minPallets) {
                minPallets = assignment.totalPallets;
                minDriver = assignment;
            }
        }

        if (minDriver) {
            minDriver.zones.push(zoneGroup.zone);
            minDriver.orders.push(...zoneGroup.orders);
            minDriver.totalPallets += zoneGroup.totalPallets;
            minDriver.totalOrders += zoneGroup.orders.length;
        }
    }

    // Separate assigned and unassigned drivers
    const assignments: DriverAssignment[] = [];
    const unassignedDrivers: Driver[] = [];

    for (const assignment of driverAssignments.values()) {
        if (assignment.zones.length > 0) {
            assignments.push(assignment);
        } else {
            unassignedDrivers.push(assignment.driver);
        }
    }

    // Sort assignments by driver name
    assignments.sort((a, b) => a.driver.name.localeCompare(b.driver.name));

    return {
        assignments,
        unassignedDrivers,
        summary: {
            totalOrders: orders.length,
            totalPallets: orders.reduce((sum, o) => sum + o.pallets, 0),
            totalZones: zoneGroups.length,
            assignedDrivers: assignments.length,
        },
        timestamp: new Date().toISOString(),
    };
}

export function formatDistributionMessage(result: DistributionResult): string {
    const lines: string[] = [];

    // Header
    lines.push('*LOGISTICS DISTRIBUTION REPORT*');
    lines.push('================================');
    lines.push(`Date: ${new Date(result.timestamp).toLocaleString('en-MY')}`);
    lines.push('');

    // Driver assignments
    for (const assignment of result.assignments) {
        lines.push(`*${assignment.driver.name}* (${assignment.driver.identifier})`);
        lines.push(`   Zones: ${assignment.zones.join(', ')}`);
        lines.push(`   ${assignment.totalOrders} orders | ${assignment.totalPallets} pallets`);
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
                lines.push(`      - ${route} (${order.pallets} pallet${order.pallets > 1 ? 's' : ''})`);
            }
        }
        lines.push('');
    }

    // Unassigned drivers
    if (result.unassignedDrivers.length > 0) {
        lines.push('*Unassigned Drivers:*');
        for (const driver of result.unassignedDrivers) {
            lines.push(`   - ${driver.name}`);
        }
        lines.push('');
    }

    // Summary
    lines.push('================================');
    lines.push('*SUMMARY*');
    lines.push(`   - Total Orders: ${result.summary.totalOrders}`);
    lines.push(`   - Total Pallets: ${result.summary.totalPallets}`);
    lines.push(`   - Zones: ${result.summary.totalZones}`);
    lines.push(`   - Assigned Drivers: ${result.summary.assignedDrivers}`);
    lines.push('================================');

    return lines.join('\n');
}

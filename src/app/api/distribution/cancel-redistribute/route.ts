import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import * as db from '@/lib/db-supabase';
import { calculateDistribution } from '@/lib/distribution';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const { targetDate } = await request.json();
    if (!targetDate) {
      return NextResponse.json({ error: 'targetDate is required' }, { status: 400 });
    }

    const existing = await db.getDistributionByDate(targetDate);
    if (!existing?.id) {
      return NextResponse.json({ error: 'No distribution found for this date' }, { status: 404 });
    }

    const orderIds = (existing.assignments || [])
      .flatMap(a => a.orders.map((o: { id: string }) => o.id))
      .filter(Boolean);

    await db.revertOrdersToPending(orderIds);
    await db.deleteDistribution(existing.id);

    const [allOrders, activeDrivers] = await Promise.all([
      db.getAllOrders(),
      db.getActiveDrivers(),
    ]);
    const pendingOrders = allOrders.filter(o => !o.status || o.status === 'pending');

    let result;
    try {
      result = calculateDistribution(pendingOrders, activeDrivers, targetDate);
    } catch (err: unknown) {
      return NextResponse.json({
        success: true,
        cancelled: true,
        redistributed: false,
        message: (err as Error).message,
      });
    }

    const distributionId = await db.saveDistribution(result);

    const orderDriverMap = result.assignments.flatMap(a =>
      a.orders.map(o => ({ orderId: o.id, driverId: a.driver.id }))
    );
    if (orderDriverMap.length > 0) {
      await db.updateOrdersToAssigned(orderDriverMap);
    }

    return NextResponse.json({
      success: true,
      cancelled: true,
      redistributed: true,
      distributionId,
      result: { ...result, id: distributionId },
    });
  } catch (error: unknown) {
    console.error('Cancel & redistribute failed:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Cancel & redistribute failed' },
      { status: 500 }
    );
  }
});

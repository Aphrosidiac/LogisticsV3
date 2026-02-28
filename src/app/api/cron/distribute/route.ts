import { NextResponse } from 'next/server';
import { calculateDistribution, formatDriverAssignmentMessage, getTomorrowDate } from '@/lib/distribution';
import { getPendingBalancesForDate, convertBalancesToOrders, batchCreateBalances } from '@/lib/balances';
import * as db from '@/lib/db-supabase';

export async function GET() {
    try {
        // 1. Load config
        const config = await db.getConfig();
        const distributionTime = config.distributionTime || '20:00';

        // 2. Check current time against scheduled time
        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
        const [schedHours, schedMinutes] = distributionTime.split(':').map(Number);
        const schedTotalMinutes = schedHours * 60 + schedMinutes;

        if (currentTotalMinutes < schedTotalMinutes) {
            return NextResponse.json({
                ran: false,
                reason: 'not time yet',
                currentTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
                scheduledAt: distributionTime,
            });
        }

        // 3. Check if already ran today
        const today = now.toISOString().split('T')[0];
        if (config.lastAutoDistributionDate === today) {
            return NextResponse.json({ ran: false, reason: 'already ran today', date: today });
        }

        // 4. Determine target date (tomorrow)
        const tomorrow = getTomorrowDate();

        // 5. Load orders and drivers
        const [allOrders, allDrivers] = await Promise.all([
            db.getAllOrders(),
            db.getAllDrivers(),
        ]);

        // Only distribute pending orders
        const pendingOrders = allOrders.filter(o => !o.status || o.status === 'pending');

        // Only use active drivers
        const activeDrivers = allDrivers.filter(d => d.is_active !== false);

        // 6. Load and merge pending balances for tomorrow
        const balances = await getPendingBalancesForDate(tomorrow);
        let ordersToDistribute = pendingOrders;

        if (balances.length > 0) {
            const balanceOrders = await convertBalancesToOrders(balances);
            ordersToDistribute = [...balanceOrders, ...pendingOrders];
        }

        // 7. Run distribution — handle "no orders" gracefully
        let result;
        try {
            result = calculateDistribution(ordersToDistribute, activeDrivers, tomorrow);
        } catch (distErr: any) {
            // No orders for tomorrow is not a failure — mark as ran and return
            await db.setLastAutoDistributionDate(today);
            return NextResponse.json({
                ran: true,
                targetDate: tomorrow,
                noOrders: true,
                message: distErr.message,
            });
        }

        // 8. Save distribution
        const distributionId = await db.saveDistribution(result);

        // 9. Mark assigned orders as 'assigned' with driver ID
        const orderDriverMap = result.assignments.flatMap(a =>
            a.orders.map(o => ({ orderId: o.id, driverId: a.driver.id }))
        );
        if (orderDriverMap.length > 0) {
            await db.updateOrdersToAssigned(orderDriverMap);
        }

        // 10. Save pending balances
        if (result.pendingBalances && result.pendingBalances.length > 0) {
            await batchCreateBalances(result.pendingBalances, distributionId);
        }

        // 11. Mark today as done
        await db.setLastAutoDistributionDate(today);

        // 12. Send WhatsApp to each assigned driver (if WhatsApp actually connected)
        const waResults: { driver: string; success: boolean }[] = [];
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        let whatsappLive = false;
        try {
            const statusRes = await fetch(`${baseUrl}/api/whatsapp/status`);
            const statusData = await statusRes.json();
            whatsappLive = statusData.connected === true;
        } catch { /* ignore — treat as disconnected */ }

        if (whatsappLive) {
            for (const assignment of result.assignments) {
                const phone = assignment.driver.phone;
                if (!phone) {
                    waResults.push({ driver: assignment.driver.name, success: false });
                    continue;
                }
                try {
                    const message = formatDriverAssignmentMessage(assignment);
                    const res = await fetch(`${baseUrl}/api/whatsapp/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recipient: phone, message }),
                    });
                    const data = await res.json();
                    waResults.push({ driver: assignment.driver.name, success: data.status === 'success' });
                    if (data.status === 'success') {
                        await db.addWhatsAppMessage(phone, message, distributionId);
                    }
                } catch {
                    waResults.push({ driver: assignment.driver.name, success: false });
                }
            }
        }

        return NextResponse.json({
            ran: true,
            targetDate: tomorrow,
            summary: result.summary,
            whatsapp: waResults,
        });

    } catch (error: any) {
        console.error('[CRON] Auto-distribution failed:', error);
        return NextResponse.json({ ran: false, error: error.message }, { status: 500 });
    }
}

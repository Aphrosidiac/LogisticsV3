import { NextRequest, NextResponse } from 'next/server';
import { calculateDistribution, formatDriverAssignmentMessage, formatDistributionMessage, getTomorrowDate } from '@/lib/distribution';
import { getPendingBalancesForDate, convertBalancesToOrders, batchCreateBalances } from '@/lib/balances';
import { getWhatsAppState, sendWhatsAppMessage } from '@/lib/whatsapp-client';
import { withInternalAuth } from '@/lib/api-auth';
import * as db from '@/lib/db-supabase';

export const GET = withInternalAuth(async (request: NextRequest) => {
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

        // 5. Load orders and drivers in parallel
        const [allOrders, activeDrivers] = await Promise.all([
            db.getAllOrders(),
            db.getActiveDrivers(),
        ]);

        // Only distribute pending orders
        const pendingOrders = allOrders.filter(o => !o.status || o.status === 'pending');

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

        // 12. Send WhatsApp based on autoMessageRecipients setting
        const recipients = config.autoMessageRecipients || 'drivers';
        const waResults: { recipient: string; success: boolean }[] = [];
        const waState = await getWhatsAppState();

        if (waState.connected) {
            const BATCH_SIZE = 5;

            // Send to drivers if 'drivers' or 'both'
            if (recipients === 'drivers' || recipients === 'both') {
                const assignments = result.assignments.filter(a => a.driver.phone);
                for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
                    const batch = assignments.slice(i, i + BATCH_SIZE);
                    const batchResults = await Promise.all(
                        batch.map(async (assignment) => {
                            try {
                                const message = formatDriverAssignmentMessage(assignment);
                                const res = await sendWhatsAppMessage(assignment.driver.phone!, message);
                                if (res.success) {
                                    await db.addWhatsAppMessage(assignment.driver.phone!, message, distributionId);
                                }
                                return { recipient: `driver:${assignment.driver.name}`, success: res.success };
                            } catch {
                                return { recipient: `driver:${assignment.driver.name}`, success: false };
                            }
                        })
                    );
                    waResults.push(...batchResults);
                    if (i + BATCH_SIZE < assignments.length) {
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
                // Record drivers without phone
                for (const a of result.assignments) {
                    if (!a.driver.phone) {
                        waResults.push({ recipient: `driver:${a.driver.name}`, success: false });
                    }
                }
            }

            // Send to admins if 'admins' or 'both'
            if (recipients === 'admins' || recipients === 'both') {
                const adminNumbers = config.adminNumbers || [];
                if (adminNumbers.length > 0) {
                    const adminMessage = formatDistributionMessage(result);
                    for (const phone of adminNumbers) {
                        try {
                            const res = await sendWhatsAppMessage(phone, adminMessage);
                            if (res.success) {
                                await db.addWhatsAppMessage(phone, adminMessage, distributionId);
                            }
                            waResults.push({ recipient: `admin:${phone}`, success: res.success });
                        } catch {
                            waResults.push({ recipient: `admin:${phone}`, success: false });
                        }
                        await new Promise(r => setTimeout(r, 300));
                    }
                }
            }
        }

        return NextResponse.json({
            ran: true,
            targetDate: tomorrow,
            summary: result.summary,
            recipients,
            whatsapp: waResults,
        });

    } catch (error: any) {
        console.error('[CRON] Auto-distribution failed:', error);
        return NextResponse.json({ ran: false, error: error.message }, { status: 500 });
    }
});

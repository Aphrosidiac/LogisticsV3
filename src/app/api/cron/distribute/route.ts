import { NextRequest, NextResponse } from 'next/server';
import { calculateDistribution, formatDriverAssignmentMessage, formatDistributionMessage, formatSkippedOrdersMessage, getTomorrowDate } from '@/lib/distribution';
import { getLocalDate } from '@/lib/utils';
import { getWhatsAppState, sendWhatsAppMessage } from '@/lib/whatsapp-client';
import { withInternalAuth } from '@/lib/api-auth';
import * as db from '@/lib/db-supabase';

export const GET = withInternalAuth(async (request: NextRequest) => {
    try {
        // 1. Load config
        const config = await db.getConfig();

        // 1a. Check if distribution is paused
        if (config.distributionPaused) {
            return NextResponse.json({ ran: false, reason: 'distribution paused' });
        }

        const distributionTime = config.distributionTime || '20:00';

        // 2. Check current time against scheduled time (in MY/SG timezone)
        const now = new Date();
        const localTimeStr = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kuala_Lumpur',
            hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(now);
        const [currentHour, currentMin] = localTimeStr.split(':').map(Number);
        const currentTotalMinutes = currentHour * 60 + currentMin;
        const [schedHours, schedMinutes] = distributionTime.split(':').map(Number);
        const schedTotalMinutes = schedHours * 60 + schedMinutes;

        if (currentTotalMinutes < schedTotalMinutes) {
            return NextResponse.json({
                ran: false,
                reason: 'not time yet',
                currentTime: localTimeStr,
                scheduledAt: distributionTime,
            });
        }

        // 3. Check if already ran today (MY/SG date)
        const today = getLocalDate();
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

        // 6. Run distribution — handle "no orders" gracefully
        let result;
        try {
            result = calculateDistribution(pendingOrders, activeDrivers, tomorrow);
        } catch (distErr: any) {
            await db.setLastAutoDistributionDate(today);
            return NextResponse.json({
                ran: true,
                targetDate: tomorrow,
                noOrders: true,
                message: distErr.message,
            });
        }

        // 7. Check for existing distribution for this date and merge if needed
        const existing = await db.getDistributionByDate(tomorrow);
        let distributionId: string;
        let finalResult = result;

        if (existing?.id) {
            // Merge new assignments into existing distribution
            const mergedAssignments = [...existing.assignments];
            for (const newAssignment of result.assignments) {
                const existingIdx = mergedAssignments.findIndex(a => a.driver.id === newAssignment.driver.id);
                if (existingIdx >= 0) {
                    const ea = mergedAssignments[existingIdx];
                    ea.orders = [...ea.orders, ...newAssignment.orders];
                    ea.totalOrders = ea.orders.length;
                    ea.totalPallets += newAssignment.totalPallets;
                    for (const z of newAssignment.zones) {
                        if (!ea.zones.includes(z)) ea.zones.push(z);
                    }
                } else {
                    mergedAssignments.push(newAssignment);
                }
            }
            const allZones = new Set<string>();
            let totalOrders = 0, totalPallets = 0;
            for (const a of mergedAssignments) {
                totalOrders += a.totalOrders;
                totalPallets += a.totalPallets;
                a.zones.forEach(z => allZones.add(z));
            }
            const assignedDriverIds = new Set(mergedAssignments.map(a => a.driver.id));
            const unassignedDrivers = activeDrivers.filter(d => !assignedDriverIds.has(d.id));
            finalResult = {
                assignments: mergedAssignments.sort((a, b) => a.driver.name.localeCompare(b.driver.name)),
                unassignedDrivers,
                skippedOrders: result.skippedOrders,
                summary: { totalOrders, totalPallets, totalZones: allZones.size, assignedDrivers: mergedAssignments.length, skippedOrders: result.skippedOrders?.length || 0 },
                timestamp: new Date().toISOString(),
                targetDate: tomorrow,
            };
            await db.updateDistribution(existing.id, finalResult);
            distributionId = existing.id;
        } else {
            distributionId = await db.saveDistribution(result);
        }

        // 8. Mark assigned orders as 'assigned' with driver ID
        const orderDriverMap = result.assignments.flatMap(a =>
            a.orders.map(o => ({ orderId: o.id, driverId: a.driver.id }))
        );
        if (orderDriverMap.length > 0) {
            await db.updateOrdersToAssigned(orderDriverMap);
        }

        // 9. Mark today as done
        await db.setLastAutoDistributionDate(today);

        // 10. Send WhatsApp based on autoMessageRecipients setting
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
                    const adminMessage = formatDistributionMessage(finalResult);
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

            // Send skipped orders alert to admins (separate message)
            if (result.skippedOrders && result.skippedOrders.length > 0) {
                const adminNumbers = config.adminNumbers || [];
                if (adminNumbers.length > 0) {
                    const skippedMsg = formatSkippedOrdersMessage(result.skippedOrders);
                    for (const phone of adminNumbers) {
                        try {
                            const res = await sendWhatsAppMessage(phone, skippedMsg);
                            if (res.success) {
                                await db.addWhatsAppMessage(phone, skippedMsg, distributionId);
                            }
                            waResults.push({ recipient: `admin-skipped:${phone}`, success: res.success });
                        } catch {
                            waResults.push({ recipient: `admin-skipped:${phone}`, success: false });
                        }
                        await new Promise(r => setTimeout(r, 300));
                    }
                }
            }
        }

        return NextResponse.json({
            ran: true,
            targetDate: tomorrow,
            summary: finalResult.summary,
            recipients,
            whatsapp: waResults,
        });

    } catch (error: any) {
        console.error('[CRON] Auto-distribution failed:', error);
        return NextResponse.json({ ran: false, error: error.message }, { status: 500 });
    }
});

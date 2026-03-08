'use client';

import { MapPin, PackageCheck, Loader, Check, X, Send, Phone } from 'lucide-react';
import { DriverAssignment, Order } from '@/types';
import { useState } from 'react';

interface DriverListItemProps {
    assignment: DriverAssignment;
    index?: number;
    onMarkDelivered?: (assignment: DriverAssignment) => Promise<void>;
    initialDelivered?: boolean;
    phone?: string;
    sendState?: { status: 'idle' | 'sending' | 'sent' | 'failed'; error?: string };
    onSend?: () => void;
}

function getCleanZoneName(zone: string): string {
    try {
        if (zone.startsWith('{')) {
            const zoneData = JSON.parse(zone);
            return zoneData.ZONE_NAME || zoneData.zone_name || zone;
        }
        return zone;
    } catch {
        return zone;
    }
}

export default function DriverListItem({ assignment, index, onMarkDelivered, initialDelivered, phone, sendState, onSend }: DriverListItemProps) {
    const [marking, setMarking] = useState(false);
    const [delivered, setDelivered] = useState(initialDelivered ?? false);
    const [confirming, setConfirming] = useState(false);

    async function handleConfirm() {
        if (!onMarkDelivered || marking || delivered) return;
        setConfirming(false);
        setMarking(true);
        try {
            await onMarkDelivered(assignment);
            setDelivered(true);
        } finally {
            setMarking(false);
        }
    }
    const maxCapacity = assignment.driver.max_capacity || 11;
    const fillPercent = Math.min(100, Math.round((assignment.totalPallets / maxCapacity) * 100));

    const utilizationColor =
        fillPercent >= 95 ? 'text-rose-400' :
        fillPercent >= 80 ? 'text-amber-400' :
        'text-emerald-400';

    const ordersByZone = assignment.zones.reduce((acc, zone) => {
        acc[zone] = assignment.orders.filter((o) => o.zone === zone);
        return acc;
    }, {} as Record<string, Order[]>);

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Driver header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/50">
                <div className="flex items-center gap-3">
                    {index !== undefined && (
                        <span className="text-xs tabular-nums text-zinc-400 w-5 text-right shrink-0">
                            {index + 1}
                        </span>
                    )}
                    <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-sm font-bold text-zinc-200 shrink-0">
                        {assignment.driver.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-white leading-tight">
                            {assignment.driver.name}
                        </h3>
                        <p className="text-xs text-zinc-400 leading-tight mt-0.5">
                            {assignment.driver.identifier}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-5 text-right">
                    <div>
                        <p className="text-xs text-zinc-400 leading-none mb-1">Zones</p>
                        <p className="text-base font-semibold text-orange-400 tabular-nums">{assignment.zones.length}</p>
                    </div>
                    <div>
                        <p className="text-xs text-zinc-400 leading-none mb-1">Orders</p>
                        <p className="text-base font-semibold text-emerald-400 tabular-nums">{assignment.totalOrders}</p>
                    </div>
                    <div>
                        <p className="text-xs text-zinc-400 leading-none mb-1">Pallets</p>
                        <p className={`text-base font-semibold tabular-nums ${utilizationColor}`}>
                            {assignment.totalPallets}
                            <span className="text-zinc-500 font-normal text-sm">/{maxCapacity}</span>
                        </p>
                    </div>

                    {onSend && (
                        <div className="flex items-center gap-2 border-l border-zinc-700 pl-4">
                            {phone ? (
                                <span className="flex items-center gap-1 text-xs text-zinc-400">
                                    <Phone className="w-3 h-3" />
                                    {phone}
                                </span>
                            ) : (
                                <span className="text-xs text-zinc-500">No phone</span>
                            )}
                            <button
                                onClick={onSend}
                                disabled={!phone || sendState?.status === 'sending'}
                                className={
                                    sendState?.status === 'sent'
                                        ? 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                                        : sendState?.status === 'failed'
                                        ? 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        : 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                                }
                            >
                                {sendState?.status === 'sending' ? (
                                    <><Loader className="w-3 h-3 animate-spin" /> Sending…</>
                                ) : sendState?.status === 'sent' ? (
                                    <><Check className="w-3 h-3" /> Sent</>
                                ) : sendState?.status === 'failed' ? (
                                    <><X className="w-3 h-3" /> Failed</>
                                ) : (
                                    <><Send className="w-3 h-3" /> Send</>
                                )}
                            </button>
                        </div>
                    )}

                    {onMarkDelivered && (
                        delivered ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium whitespace-nowrap border-l border-zinc-700 pl-5">
                                <PackageCheck className="w-3.5 h-3.5" />
                                Delivered
                            </span>
                        ) : confirming ? (
                            <div className="flex items-center gap-2 border-l border-zinc-700 pl-5">
                                <span className="text-xs text-zinc-400 whitespace-nowrap">Mark all as delivered?</span>
                                <button
                                    onClick={handleConfirm}
                                    disabled={marking}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                                >
                                    {marking
                                        ? <><Loader className="w-3 h-3 animate-spin" /> Marking…</>
                                        : <><Check className="w-3 h-3" /> Confirm</>
                                    }
                                </button>
                                <button
                                    onClick={() => setConfirming(false)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 bg-zinc-700/50 hover:bg-zinc-700 transition-colors"
                                >
                                    <X className="w-3 h-3" /> Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirming(true)}
                                disabled={marking}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait whitespace-nowrap ml-1"
                            >
                                <PackageCheck className="w-3 h-3" /> Mark Delivered
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-3" onClick={e => e.stopPropagation()}>
                {/* Zone tags */}
                <div className="flex flex-wrap gap-1.5">
                    {assignment.zones.map((zone) => (
                        <span
                            key={zone}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-300 text-xs font-medium border border-orange-500/20"
                        >
                            <MapPin className="w-3 h-3" />
                            {getCleanZoneName(zone)}
                        </span>
                    ))}
                </div>

                {/* Orders by zone */}
                <div className="space-y-2.5">
                    {Object.entries(ordersByZone).map(([zone, orders]) => (
                        <div key={zone}>
                            <p className="text-xs text-zinc-400 mb-1.5 pl-0.5">
                                {getCleanZoneName(zone)}
                                <span className="text-zinc-500 ml-1">
                                    — {orders.length} order{orders.length !== 1 ? 's' : ''}
                                </span>
                            </p>
                            <div className="space-y-1">
                                {orders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="flex items-center justify-between text-sm bg-zinc-800/40 border border-zinc-800/60 rounded-lg px-3 py-2"
                                    >
                                        <div className="flex items-center gap-3 text-zinc-300 min-w-0">
                                            {order.do_number && (
                                                <span className="text-zinc-400 shrink-0 font-mono text-xs">
                                                    {order.do_number}
                                                </span>
                                            )}
                                            <span className="truncate">
                                                {order.pickup || '-'}
                                                <span className="text-zinc-500 mx-1">→</span>
                                                {order.delivery || '-'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-3">
                                            {order.priority === 'high' ? (
                                                <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                                    High
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                                                    Std
                                                </span>
                                            )}
                                            <span className="text-purple-300 font-semibold tabular-nums">
                                                {order.pallets}
                                                <span className="text-zinc-500 font-normal">p</span>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}

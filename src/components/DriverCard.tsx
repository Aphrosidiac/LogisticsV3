'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { DriverAssignment, Order } from '@/types';

interface DriverCardProps {
    assignment: DriverAssignment;
}

export default function DriverCard({ assignment }: DriverCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Group orders by zone
    const ordersByZone = assignment.zones.reduce((acc, zone) => {
        acc[zone] = assignment.orders.filter((o) => o.zone === zone);
        return acc;
    }, {} as Record<string, Order[]>);

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden transition-all duration-300 hover:border-zinc-700">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-5 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                        {assignment.driver.identifier.charAt(0)}
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-semibold text-white">
                            {assignment.driver.name}
                        </h3>
                        <p className="text-sm text-zinc-500">
                            {assignment.driver.identifier}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Stats */}
                    <div className="flex gap-4 text-sm">
                        <div className="text-center">
                            <p className="text-orange-400 font-semibold">{assignment.zones.length}</p>
                            <p className="text-zinc-500 text-xs">Zones</p>
                        </div>
                        <div className="text-center">
                            <p className="text-emerald-400 font-semibold">{assignment.totalOrders}</p>
                            <p className="text-zinc-500 text-xs">Orders</p>
                        </div>
                        <div className="text-center">
                            <p className="text-purple-400 font-semibold">{assignment.totalPallets}</p>
                            <p className="text-zinc-500 text-xs">Pallets</p>
                        </div>
                    </div>

                    {/* Expand icon */}
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-zinc-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-zinc-400" />
                    )}
                </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="p-5 pt-0 space-y-4">
                    {/* Zone badges */}
                    <div className="flex flex-wrap gap-2">
                        {assignment.zones.map((zone) => (
                            <span
                                key={zone}
                                className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-sm font-medium border border-orange-500/30"
                            >
                                Zone {zone}
                            </span>
                        ))}
                    </div>

                    {/* Orders by zone */}
                    {Object.entries(ordersByZone).map(([zone, orders]) => (
                        <div key={zone} className="mt-4">
                            <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                Zone {zone} ({orders.length} orders)
                            </h4>
                            <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-zinc-800">
                                            <th className="px-4 py-2 text-left text-zinc-400 font-medium">Pickup</th>
                                            <th className="px-4 py-2 text-left text-zinc-400 font-medium">Delivery</th>
                                            <th className="px-4 py-2 text-right text-zinc-400 font-medium">Pallets</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map((order) => (
                                            <tr key={order.id} className="border-t border-zinc-700/50">
                                                <td className="px-4 py-3 text-zinc-300">
                                                    {order.pickup || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-zinc-300">
                                                    {order.delivery || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-purple-400 font-medium">
                                                    {order.pallets}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

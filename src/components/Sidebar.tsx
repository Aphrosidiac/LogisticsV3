'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    FileSpreadsheet,
    Truck,
    Settings,
    ScrollText,
    Package,
    Users,
    MessageSquare,
    Database,
} from 'lucide-react';

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/sheets-manager', label: 'Database Manager', icon: Database },
    { href: '/drivers', label: 'Drivers', icon: Users },
    { href: '/distribution', label: 'Distribution', icon: Truck },
    { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { href: '/backup', label: 'Backup & Restore', icon: FileSpreadsheet },
    { href: '/admin', label: 'Admin Settings', icon: Settings },
    { href: '/logs', label: 'Activity Logs', icon: ScrollText },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 h-full w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <Package className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">Logistics</h1>
                        <p className="text-xs text-zinc-500">Distribution Tool</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                }`}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800">
                <p className="text-xs text-zinc-600 text-center">
                    Logistics Distribution v3.0
                </p>
            </div>
        </aside>
    );
}

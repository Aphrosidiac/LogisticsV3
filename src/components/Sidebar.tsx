'use client';

import Link from 'next/link';
/* eslint-disable @next/next/no-img-element */
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    FileSpreadsheet,
    Truck,
    Settings,
    ScrollText,
    MessageSquare,
    Database,
    CheckCircle,
    MapPin,
    Building2,
    LogOut,
} from 'lucide-react';

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/sheets-manager', label: 'Database Manager', icon: Database },
    { href: '/distribution', label: 'Distribution', icon: Truck },
    { href: '/completed-orders', label: 'Completed Orders', icon: CheckCircle },
    { href: '/zones', label: 'Zones & Districts', icon: MapPin },
    { href: '/clients', label: 'Clients', icon: Building2 },
    { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { href: '/admin', label: 'Admin Settings', icon: Settings },
    { href: '/backup', label: 'Backup & Restore', icon: FileSpreadsheet },
    { href: '/logs', label: 'Activity Logs', icon: ScrollText },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
    }

    return (
        <aside className="fixed left-0 top-0 h-full w-64 bg-zinc-900 border-r border-zinc-800/80 flex flex-col">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-zinc-800">
                <Link href="/" className="block">
                    <img
                        src="/logo-white.png"
                        alt="Shuda Logistics"
                        className="logo-invertible w-full h-auto opacity-90 hover:opacity-100 transition-opacity"
                    />
                </Link>
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
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border ${isActive
                                    ? 'bg-violet-500/15 text-violet-300 border-violet-500/25'
                                    : 'border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                }`}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-800 space-y-3">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-rose-400 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Logout</span>
                </button>
                <p className="text-xs text-zinc-600 text-center">
                    Shuda Logistics v3.0
                </p>
            </div>
        </aside>
    );
}

import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    color: 'emerald' | 'blue' | 'purple' | 'orange' | 'rose';
    subtitle?: string;
}

const colorClasses = {
    emerald: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        icon: 'text-emerald-400',
        glow: 'shadow-emerald-500/5',
    },
    blue: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: 'text-blue-400',
        glow: 'shadow-blue-500/5',
    },
    purple: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
        icon: 'text-purple-400',
        glow: 'shadow-purple-500/5',
    },
    orange: {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/20',
        icon: 'text-orange-400',
        glow: 'shadow-orange-500/5',
    },
    rose: {
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/20',
        icon: 'text-rose-400',
        glow: 'shadow-rose-500/5',
    },
};

export default function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
    const colors = colorClasses[color];

    return (
        <div
            className={`relative p-6 rounded-2xl border ${colors.bg} ${colors.border} ${colors.glow} shadow-xl backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl`}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-zinc-500 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-white">{value}</p>
                    {subtitle && (
                        <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
                    )}
                </div>
                <div className={`p-3 rounded-xl ${colors.bg}`}>
                    <Icon className={`w-6 h-6 ${colors.icon}`} />
                </div>
            </div>
        </div>
    );
}

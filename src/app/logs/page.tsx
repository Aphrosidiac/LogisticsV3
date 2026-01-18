'use client';

import { useApp } from '@/context/AppContext';
import { clearLogs } from '@/lib/storage';
import {
    ScrollText,
    Trash2,
    Info,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
} from 'lucide-react';

const typeConfig = {
    info: {
        icon: Info,
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
    },
    success: {
        icon: CheckCircle2,
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
    },
    error: {
        icon: AlertCircle,
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        text: 'text-rose-400',
    },
    warning: {
        icon: AlertTriangle,
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        text: 'text-orange-400',
    },
};

export default function LogsPage() {
    const { logs, dispatch, addLog } = useApp();

    const handleClearLogs = () => {
        clearLogs();
        dispatch({ type: 'CLEAR_LOGS' });
        // Add one log entry to confirm clearing
        addLog('info', 'Logs cleared');
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Activity Logs</h1>
                    <p className="text-zinc-500 mt-1">
                        View recent activity and system events
                    </p>
                </div>

                {logs.length > 1 && (
                    <button
                        onClick={handleClearLogs}
                        className="btn-danger flex items-center gap-2"
                    >
                        <Trash2 className="w-5 h-5" />
                        Clear Logs
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-sm">
                <div className="px-4 py-2 bg-zinc-800/50 rounded-lg">
                    <span className="text-zinc-400">Total entries:</span>{' '}
                    <span className="text-white font-medium">{logs.length}</span>
                </div>
                <div className="px-4 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <span className="text-emerald-400">
                        {logs.filter((l) => l.type === 'success').length} success
                    </span>
                </div>
                <div className="px-4 py-2 bg-rose-500/10 rounded-lg border border-rose-500/20">
                    <span className="text-rose-400">
                        {logs.filter((l) => l.type === 'error').length} errors
                    </span>
                </div>
            </div>

            {/* Logs List */}
            {logs.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800 flex items-center justify-center">
                        <ScrollText className="w-8 h-8 text-zinc-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">No Logs Yet</h2>
                    <p className="text-zinc-500">
                        Activity will be logged here as you use the application
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {logs.map((log) => {
                        const config = typeConfig[log.type];
                        const Icon = config.icon;

                        return (
                            <div
                                key={log.id}
                                className={`p-4 rounded-xl border ${config.bg} ${config.border} transition-all hover:scale-[1.01]`}
                            >
                                <div className="flex items-start gap-3">
                                    <Icon className={`w-5 h-5 ${config.text} flex-shrink-0 mt-0.5`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-4">
                                            <p className="text-zinc-200 font-medium">{log.message}</p>
                                            <span className="text-xs text-zinc-500 flex-shrink-0">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        {log.details && (
                                            <p className="text-sm text-zinc-400 mt-1 truncate">
                                                {log.details}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

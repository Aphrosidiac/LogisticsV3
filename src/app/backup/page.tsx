'use client';

import { useState } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle, Database } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import * as db from '@/lib/db-supabase';

export default function BackupPage() {
    const { addLog } = useApp();
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    async function handleExport() {
        setIsExporting(true);
        try {
            const data = await db.exportAllData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `logistics-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            addLog('success', 'Data exported successfully');
        } catch (error: any) {
            addLog('error', 'Export failed', error.message);
        } finally {
            setIsExporting(false);
        }
    }

    async function handleImport(file: File) {
        if (!confirm('This will replace all existing data. Are you sure?')) {
            return;
        }

        setIsImporting(true);
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            await db.importAllData(data);
            addLog('success', 'Data imported successfully');
            window.location.reload();
        } catch (error: any) {
            addLog('error', 'Import failed', error.message);
        } finally {
            setIsImporting(false);
        }
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Backup & Restore</h1>
                <p className="text-zinc-500 mt-1">
                    Export and import your database for backup and recovery
                </p>
            </div>

            {/* Export/Import Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Card */}
                <div className="card p-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-emerald-500/20 rounded-lg">
                            <Download className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Export Data</h2>
                            <p className="text-sm text-zinc-400">Download all your data</p>
                        </div>
                    </div>

                    <p className="text-sm text-zinc-400 mb-6">
                        Export all sheets, orders, drivers, distributions, and logs to a JSON file for backup.
                    </p>

                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {isExporting ? (
                            <>Exporting...</>
                        ) : (
                            <>
                                <Download className="w-5 h-5" />
                                Export Backup
                            </>
                        )}
                    </button>
                </div>

                {/* Import Card */}
                <div className="card p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-lg">
                            <Upload className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Import Data</h2>
                            <p className="text-sm text-zinc-400">Restore from backup</p>
                        </div>
                    </div>

                    <p className="text-sm text-zinc-400 mb-6">
                        Import a previously exported backup file to restore all data.
                    </p>

                    <label className="block">
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImport(file);
                            }}
                            disabled={isImporting}
                        />
                        <div className="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer">
                            {isImporting ? (
                                <>Importing...</>
                            ) : (
                                <>
                                    <Upload className="w-5 h-5" />
                                    Import Backup
                                </>
                            )}
                        </div>
                    </label>
                </div>
            </div>

            {/* Warning */}
            <div className="alert-warning flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-medium text-yellow-400 mb-2">Important Notes</h3>
                    <ul className="text-sm text-yellow-400/80 space-y-1 list-disc list-inside">
                        <li>Importing a backup will replace ALL existing data</li>
                        <li>Always export a backup before importing</li>
                        <li>Store backups in a safe location</li>
                        <li>Regular backups are recommended</li>
                    </ul>
                </div>
            </div>

            {/* Info */}
            <div className="card p-6">
                <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-white mb-2">What's Included</h3>
                        <ul className="text-sm text-zinc-400 space-y-1 list-disc list-inside">
                            <li>All database sheets (orders and drivers)</li>
                            <li>Current orders and drivers data</li>
                            <li>Distribution history</li>
                            <li>Activity logs</li>
                            <li>WhatsApp message history</li>
                            <li>Configuration settings</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

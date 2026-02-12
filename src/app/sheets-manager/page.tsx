'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    FileSpreadsheet,
    Plus,
    Download,
    Upload,
    Trash2,
    Save,
    Database,
    RefreshCw,
    Edit2,
    X,
    Check,
    PlusCircle,
    MinusCircle
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import * as db from '@/lib/db';
import * as csv from '@/lib/csv';
import type { Sheet } from '@/types';

export default function SheetsManagerPage() {
    const { addLog, dispatch } = useApp();
    const [sheets, setSheets] = useState<Sheet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<Record<string, 'synced' | 'syncing'>>({});

    useEffect(() => {
        loadSheets();
    }, []);

    async function loadSheets() {
        try {
            const allSheets = await db.getAllSheets();
            setSheets(allSheets);
        } catch (error: any) {
            addLog('error', 'Failed to load sheets', error.message);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleCreateSheet(name: string, type: 'orders' | 'drivers') {
        try {
            const headers = type === 'orders'
                ? ['Zone', 'Pallets', 'Date', 'Pickup', 'Delivery', 'Invoice']
                : ['Driver Name', 'Identifier'];

            const newSheet = await db.createSheet(name, type, headers, []);
            addLog('success', `Created ${type} database: ${name}`);
            await loadSheets();
            setShowCreateModal(false);
            setActiveSheetId(newSheet.id);
        } catch (error: any) {
            addLog('error', 'Failed to create database', error.message);
        }
    }

    async function handleImportCSV(sheetId: string, file: File) {
        try {
            const parsed = await csv.parseCSVFile(file);
            await db.updateSheet(sheetId, {
                headers: parsed.headers,
                data: parsed.data,
            });

            // Auto-sync to system
            const sheet = await db.getSheet(sheetId);
            if (sheet) {
                await syncToSystem(sheet);
            }

            addLog('success', `Imported and synced CSV data`);
            await loadSheets();
        } catch (error: any) {
            addLog('error', 'Failed to import CSV', error.message);
        }
    }

    async function handleExportCSV(sheet: Sheet) {
        try {
            const csvContent = csv.sheetDataToCSV(sheet.headers, sheet.data);
            csv.downloadCSV(`${sheet.name}.csv`, csvContent);
            addLog('success', `Exported database: ${sheet.name}`);
        } catch (error: any) {
            addLog('error', 'Failed to export CSV', error.message);
        }
    }

    async function handleDeleteSheet(sheetId: string) {
        if (!confirm('Are you sure you want to delete this database? This will not affect already loaded system data.')) return;

        try {
            await db.deleteSheet(sheetId);
            addLog('success', 'Database deleted');
            if (activeSheetId === sheetId) {
                setActiveSheetId(null);
            }
            await loadSheets();
        } catch (error: any) {
            addLog('error', 'Failed to delete database', error.message);
        }
    }

    async function syncToSystem(sheet: Sheet) {
        try {
            setSyncStatus(prev => ({ ...prev, [sheet.id]: 'syncing' }));

            if (sheet.type === 'orders') {
                const orders = csv.csvToOrders(sheet.data);
                await db.saveOrders(orders, sheet.id);
                dispatch({ type: 'SET_ORDERS', payload: orders });
                addLog('info', `Auto-synced ${orders.length} orders from ${sheet.name}`);
            } else {
                const drivers = csv.csvToDrivers(sheet.data);
                await db.saveDrivers(drivers, sheet.id);
                dispatch({ type: 'SET_DRIVERS', payload: drivers });
                addLog('info', `Auto-synced ${drivers.length} drivers from ${sheet.name}`);
            }

            setSyncStatus(prev => ({ ...prev, [sheet.id]: 'synced' }));
        } catch (error: any) {
            addLog('error', 'Failed to sync data', error.message);
            setSyncStatus(prev => ({ ...prev, [sheet.id]: 'synced' }));
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const activeSheet = sheets.find(s => s.id === activeSheetId);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Live Database System</h1>
                    <p className="text-zinc-500 mt-1">
                        Edit data directly - changes sync automatically to the system
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    New Database
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar - Database List */}
                <div className="lg:col-span-1 space-y-3">
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Databases</h2>
                    {sheets.map((sheet) => (
                        <button
                            key={sheet.id}
                            onClick={() => setActiveSheetId(sheet.id)}
                            className={`w-full text-left p-4 rounded-xl border transition-all ${
                                activeSheetId === sheet.id
                                    ? 'bg-emerald-500/10 border-emerald-500/50'
                                    : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                            }`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-emerald-400" />
                                    <h3 className="font-semibold text-white text-sm">{sheet.name}</h3>
                                </div>
                                {syncStatus[sheet.id] === 'syncing' && (
                                    <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className={`px-2 py-0.5 rounded ${
                                    sheet.type === 'orders'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'bg-purple-500/20 text-purple-400'
                                }`}>
                                    {sheet.type}
                                </span>
                                <span className="text-zinc-500">{sheet.data.length} rows</span>
                            </div>
                        </button>
                    ))}

                    {sheets.length === 0 && (
                        <div className="text-center py-8 px-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                            <FileSpreadsheet className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                            <p className="text-sm text-zinc-500">No databases yet</p>
                        </div>
                    )}
                </div>

                {/* Main Content - Live Editor */}
                <div className="lg:col-span-3">
                    {activeSheet ? (
                        <LiveSheetEditor
                            sheet={activeSheet}
                            onUpdate={async (updatedSheet) => {
                                await db.updateSheet(updatedSheet.id, updatedSheet);
                                await syncToSystem(updatedSheet);
                                await loadSheets();
                            }}
                            onDelete={() => handleDeleteSheet(activeSheet.id)}
                            onExport={() => handleExportCSV(activeSheet)}
                            onImport={(file) => handleImportCSV(activeSheet.id, file)}
                            addLog={addLog}
                        />
                    ) : (
                        <div className="card p-12 text-center">
                            <Database className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-white mb-2">
                                Select a database to edit
                            </h3>
                            <p className="text-zinc-500 mb-6">
                                Choose a database from the sidebar or create a new one
                            </p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                                Create Database
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Sheet Modal */}
            {showCreateModal && (
                <CreateSheetModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateSheet}
                />
            )}
        </div>
    );
}

function LiveSheetEditor({
    sheet,
    onUpdate,
    onDelete,
    onExport,
    onImport,
    addLog
}: {
    sheet: Sheet;
    onUpdate: (sheet: Sheet) => void;
    onDelete: () => void;
    onExport: () => void;
    onImport: (file: File) => void;
    addLog: (type: any, message: string, details?: string) => void;
}) {
    const [editedSheet, setEditedSheet] = useState(sheet);
    const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setEditedSheet(sheet);
        setHasChanges(false);
    }, [sheet]);

    const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
        const newData = [...editedSheet.data];
        const header = editedSheet.headers[colIndex];
        newData[rowIndex] = { ...newData[rowIndex], [header]: value };

        const updatedSheet = { ...editedSheet, data: newData };
        setEditedSheet(updatedSheet);
        setHasChanges(true);

        // Auto-save after 500ms of no changes
        setTimeout(() => {
            onUpdate(updatedSheet);
            setHasChanges(false);
        }, 500);
    }, [editedSheet, onUpdate]);

    const addRow = () => {
        const newRow: Record<string, any> = {};
        editedSheet.headers.forEach(header => {
            newRow[header] = '';
        });
        const updatedSheet = {
            ...editedSheet,
            data: [...editedSheet.data, newRow]
        };
        setEditedSheet(updatedSheet);
        onUpdate(updatedSheet);
        addLog('success', 'Added new row');
    };

    const deleteRow = (rowIndex: number) => {
        if (!confirm('Delete this row?')) return;
        const newData = editedSheet.data.filter((_, i) => i !== rowIndex);
        const updatedSheet = { ...editedSheet, data: newData };
        setEditedSheet(updatedSheet);
        onUpdate(updatedSheet);
        addLog('success', 'Deleted row');
    };

    return (
        <div className="card">
            {/* Header */}
            <div className="p-4 border-b border-zinc-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white">{sheet.name}</h2>
                        <p className="text-sm text-zinc-500 mt-1">
                            {editedSheet.data.length} rows × {editedSheet.headers.length} columns
                            {hasChanges && <span className="text-emerald-400 ml-2">• Saving...</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="btn-secondary cursor-pointer">
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) onImport(file);
                                }}
                            />
                            <Upload className="w-4 h-4" />
                            Import
                        </label>
                        <button onClick={onExport} className="btn-secondary">
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                        <button
                            onClick={onDelete}
                            className="btn-secondary text-red-400 hover:bg-red-500/10"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Spreadsheet */}
            <div className="p-4 overflow-auto max-h-[600px]">
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-zinc-800 z-10">
                        <tr>
                            <th className="px-2 py-2 text-xs font-semibold text-zinc-400 border border-zinc-700 bg-zinc-800">#</th>
                            {editedSheet.headers.map((header, idx) => (
                                <th key={idx} className="px-4 py-2 text-left text-sm font-semibold text-white border border-zinc-700 bg-zinc-800">
                                    {header}
                                </th>
                            ))}
                            <th className="px-2 py-2 text-xs font-semibold text-zinc-400 border border-zinc-700 bg-zinc-800">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {editedSheet.data.map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-zinc-800/50">
                                <td className="px-2 py-2 text-xs text-zinc-500 border border-zinc-700 text-center">
                                    {rowIndex + 1}
                                </td>
                                {editedSheet.headers.map((header, colIndex) => {
                                    const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                                    return (
                                        <td
                                            key={colIndex}
                                            className="px-2 py-1 border border-zinc-700 cursor-pointer hover:bg-zinc-800"
                                            onClick={() => setEditingCell({ row: rowIndex, col: colIndex })}
                                        >
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={row[header] || ''}
                                                    onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                                    onBlur={() => setEditingCell(null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') setEditingCell(null);
                                                        if (e.key === 'Escape') {
                                                            setEditedSheet(sheet);
                                                            setEditingCell(null);
                                                        }
                                                    }}
                                                    autoFocus
                                                    className="w-full px-2 py-1 bg-zinc-900 text-white border border-emerald-500 rounded focus:outline-none"
                                                />
                                            ) : (
                                                <div className="px-2 py-1 text-sm text-zinc-200 min-h-[32px] flex items-center">
                                                    {row[header] || <span className="text-zinc-600">-</span>}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="px-2 py-1 border border-zinc-700 text-center">
                                    <button
                                        onClick={() => deleteRow(rowIndex)}
                                        className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                        title="Delete row"
                                    >
                                        <MinusCircle className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <button
                    onClick={addRow}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800/50 border border-zinc-700 border-dashed rounded-lg hover:bg-zinc-800 hover:border-emerald-500/50 text-zinc-400 hover:text-emerald-400 transition-all"
                >
                    <PlusCircle className="w-5 h-5" />
                    Add Row
                </button>
            </div>

            <div className="p-4 border-t border-zinc-700 bg-zinc-800/30">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Changes are automatically synchronized to the system</span>
                </div>
            </div>
        </div>
    );
}

function CreateSheetModal({ onClose, onCreate }: {
    onClose: () => void;
    onCreate: (name: string, type: 'orders' | 'drivers') => void;
}) {
    const [name, setName] = useState('');
    const [type, setType] = useState<'orders' | 'drivers'>('orders');

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-4">Create New Database</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Database Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., January Orders"
                            className="input w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Database Type
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as 'orders' | 'drivers')}
                            className="input w-full"
                        >
                            <option value="orders">Orders Database</option>
                            <option value="drivers">Drivers Database</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={() => {
                            if (name.trim()) {
                                onCreate(name.trim(), type);
                            }
                        }}
                        disabled={!name.trim()}
                        className="btn-primary flex-1"
                    >
                        Create
                    </button>
                    <button onClick={onClose} className="btn-secondary flex-1">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

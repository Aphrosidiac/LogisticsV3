'use client';

import { useState, useEffect } from 'react';
import { FileSpreadsheet, Plus, Download, Upload, Trash2, Edit, Table } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import * as db from '@/lib/db';
import * as csv from '@/lib/csv';
import type { Sheet } from '@/types';

export default function SheetsManagerPage() {
    const { addLog } = useApp();
    const [sheets, setSheets] = useState<Sheet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingSheet, setEditingSheet] = useState<Sheet | null>(null);

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

            await db.createSheet(name, type, headers, []);
            addLog('success', `Created ${type} sheet: ${name}`);
            await loadSheets();
            setShowCreateModal(false);
        } catch (error: any) {
            addLog('error', 'Failed to create sheet', error.message);
        }
    }

    async function handleImportCSV(sheetId: string, file: File) {
        try {
            const parsed = await csv.parseCSVFile(file);
            await db.updateSheet(sheetId, {
                headers: parsed.headers,
                data: parsed.data,
            });
            addLog('success', `Imported CSV data to sheet`);
            await loadSheets();
        } catch (error: any) {
            addLog('error', 'Failed to import CSV', error.message);
        }
    }

    async function handleExportCSV(sheet: Sheet) {
        try {
            const csvContent = csv.sheetDataToCSV(sheet.headers, sheet.data);
            csv.downloadCSV(`${sheet.name}.csv`, csvContent);
            addLog('success', `Exported sheet: ${sheet.name}`);
        } catch (error: any) {
            addLog('error', 'Failed to export CSV', error.message);
        }
    }

    async function handleDeleteSheet(sheetId: string) {
        if (!confirm('Are you sure you want to delete this sheet?')) return;

        try {
            await db.deleteSheet(sheetId);
            addLog('success', 'Sheet deleted');
            await loadSheets();
        } catch (error: any) {
            addLog('error', 'Failed to delete sheet', error.message);
        }
    }

    async function handleLoadToSystem(sheet: Sheet) {
        try {
            if (sheet.type === 'orders') {
                const orders = csv.csvToOrders(sheet.data);
                await db.saveOrders(orders, sheet.id);
                addLog('success', `Loaded ${orders.length} orders from sheet`);
            } else {
                const drivers = csv.csvToDrivers(sheet.data);
                await db.saveDrivers(drivers, sheet.id);
                addLog('success', `Loaded ${drivers.length} drivers from sheet`);
            }
        } catch (error: any) {
            addLog('error', 'Failed to load data', error.message);
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                <div className="text-gray-600">Loading sheets...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                        <h1 className="text-2xl font-bold text-gray-900">Sheets Manager</h1>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        New Sheet
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sheets.map((sheet) => (
                        <div key={sheet.id} className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{sheet.name}</h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {sheet.type === 'orders' ? 'Orders Sheet' : 'Drivers Sheet'}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                    sheet.type === 'orders'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-green-100 text-green-700'
                                }`}>
                                    {sheet.type}
                                </span>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">Rows:</span> {sheet.data.length}
                                </div>
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">Columns:</span> {sheet.headers.length}
                                </div>
                                <div className="text-sm text-gray-500">
                                    Updated: {new Date(sheet.updatedAt).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => handleLoadToSystem(sheet)}
                                    className="flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                                >
                                    <Table className="w-4 h-4" />
                                    Load to System
                                </button>

                                <div className="flex gap-2">
                                    <label className="flex-1">
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImportCSV(sheet.id, file);
                                            }}
                                        />
                                        <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm cursor-pointer hover:bg-gray-200 transition-colors">
                                            <Upload className="w-4 h-4" />
                                            Import
                                        </div>
                                    </label>

                                    <button
                                        onClick={() => handleExportCSV(sheet)}
                                        className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setEditingSheet(sheet)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded text-sm hover:bg-blue-100 transition-colors"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </button>

                                    <button
                                        onClick={() => handleDeleteSheet(sheet.id)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded text-sm hover:bg-red-100 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {sheets.length === 0 && (
                    <div className="text-center py-12">
                        <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No sheets yet</h3>
                        <p className="text-gray-600 mb-4">Create your first sheet to get started</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Create Sheet
                        </button>
                    </div>
                )}
            </div>

            {/* Create Sheet Modal */}
            {showCreateModal && (
                <CreateSheetModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateSheet}
                />
            )}

            {/* Edit Sheet Modal */}
            {editingSheet && (
                <EditSheetModal
                    sheet={editingSheet}
                    onClose={() => setEditingSheet(null)}
                    onSave={async (sheet) => {
                        await db.updateSheet(sheet.id, sheet);
                        await loadSheets();
                        setEditingSheet(null);
                        addLog('success', 'Sheet updated');
                    }}
                />
            )}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Sheet</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sheet Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., January Orders"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sheet Type
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as 'orders' | 'drivers')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="orders">Orders Sheet</option>
                            <option value="drivers">Drivers Sheet</option>
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
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Create
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditSheetModal({ sheet, onClose, onSave }: {
    sheet: Sheet;
    onClose: () => void;
    onSave: (sheet: Sheet) => void;
}) {
    const [editedSheet, setEditedSheet] = useState(sheet);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-auto">
            <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-auto">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Sheet: {sheet.name}</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sheet Name
                        </label>
                        <input
                            type="text"
                            value={editedSheet.name}
                            onChange={(e) => setEditedSheet({ ...editedSheet, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <p className="text-sm text-gray-600 mb-2">
                            {editedSheet.data.length} rows, {editedSheet.headers.length} columns
                        </p>
                        <p className="text-xs text-gray-500">
                            To edit data, export as CSV, edit in a spreadsheet app, then import back.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={() => onSave(editedSheet)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Save
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

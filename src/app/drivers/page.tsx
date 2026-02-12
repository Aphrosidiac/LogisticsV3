'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Search } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import * as db from '@/lib/db';
import type { Driver } from '@/types';

export default function DriversPage() {
    const { addLog } = useApp();
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

    useEffect(() => {
        loadDrivers();
    }, []);

    useEffect(() => {
        if (searchTerm) {
            const filtered = drivers.filter(
                (d) =>
                    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    d.identifier.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredDrivers(filtered);
        } else {
            setFilteredDrivers(drivers);
        }
    }, [searchTerm, drivers]);

    async function loadDrivers() {
        try {
            const allDrivers = await db.getAllDrivers();
            setDrivers(allDrivers);
            setFilteredDrivers(allDrivers);
        } catch (error: any) {
            addLog('error', 'Failed to load drivers', error.message);
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSaveDriver(driver: Omit<Driver, 'id'> & { id?: string }) {
        try {
            if (driver.id) {
                await db.updateDriver(driver.id, driver);
                addLog('success', `Updated driver: ${driver.name}`);
            } else {
                await db.addDriver({ ...driver, id: crypto.randomUUID() });
                addLog('success', `Added driver: ${driver.name}`);
            }
            await loadDrivers();
            setShowModal(false);
            setEditingDriver(null);
        } catch (error: any) {
            addLog('error', 'Failed to save driver', error.message);
        }
    }

    async function handleDeleteDriver(driver: Driver) {
        if (!confirm(`Are you sure you want to delete ${driver.name}?`)) return;

        try {
            await db.deleteDriver(driver.id);
            addLog('success', `Deleted driver: ${driver.name}`);
            await loadDrivers();
        } catch (error: any) {
            addLog('error', 'Failed to delete driver', error.message);
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
                <div className="text-gray-600">Loading drivers...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Users className="w-8 h-8 text-blue-600" />
                        <h1 className="text-2xl font-bold text-gray-900">Driver Management</h1>
                    </div>
                    <button
                        onClick={() => {
                            setEditingDriver(null);
                            setShowModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Add Driver
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow mb-6 p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search drivers..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Identifier
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredDrivers.map((driver) => (
                                <tr key={driver.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{driver.name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-600">{driver.identifier}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => {
                                                setEditingDriver(driver);
                                                setShowModal(true);
                                            }}
                                            className="text-blue-600 hover:text-blue-900 mr-4"
                                        >
                                            <Edit className="w-4 h-4 inline" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteDriver(driver)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            <Trash2 className="w-4 h-4 inline" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredDrivers.length === 0 && (
                        <div className="text-center py-12">
                            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                {searchTerm ? 'No drivers found' : 'No drivers yet'}
                            </h3>
                            <p className="text-gray-600 mb-4">
                                {searchTerm
                                    ? 'Try a different search term'
                                    : 'Add your first driver to get started'}
                            </p>
                            {!searchTerm && (
                                <button
                                    onClick={() => {
                                        setEditingDriver(null);
                                        setShowModal(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Plus className="w-5 h-5" />
                                    Add Driver
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-4 text-sm text-gray-600">
                    Total drivers: {drivers.length}
                    {searchTerm && ` (${filteredDrivers.length} matching)`}
                </div>
            </div>

            {showModal && (
                <DriverModal
                    driver={editingDriver}
                    onClose={() => {
                        setShowModal(false);
                        setEditingDriver(null);
                    }}
                    onSave={handleSaveDriver}
                />
            )}
        </div>
    );
}

function DriverModal({
    driver,
    onClose,
    onSave,
}: {
    driver: Driver | null;
    onClose: () => void;
    onSave: (driver: Omit<Driver, 'id'> & { id?: string }) => void;
}) {
    const [name, setName] = useState(driver?.name || '');
    const [identifier, setIdentifier] = useState(driver?.identifier || '');

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                    {driver ? 'Edit Driver' : 'Add New Driver'}
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Driver Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., John Doe"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Identifier *
                        </label>
                        <input
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="e.g., D-001 or Truck #5"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={() => {
                            if (name.trim() && identifier.trim()) {
                                onSave({
                                    ...(driver?.id ? { id: driver.id } : {}),
                                    name: name.trim(),
                                    identifier: identifier.trim(),
                                });
                            }
                        }}
                        disabled={!name.trim() || !identifier.trim()}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {driver ? 'Update' : 'Add'}
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

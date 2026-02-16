'use client';

import { useState, useEffect } from 'react';
import {
  migrateToSupabase,
  checkMigrationStatus,
  exportIndexedDBBackup,
  MigrationResult,
} from '@/lib/migrate';
import { Database, Download, Upload, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

export default function MigratePage() {
  const [migrationStatus, setMigrationStatus] = useState<{
    hasMigrated: boolean;
    hasIndexedDBData: boolean;
    hasSupabaseData: boolean;
  } | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const status = await checkMigrationStatus();
      setMigrationStatus(status);
    } catch (error) {
      console.error('Error checking migration status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      await exportIndexedDBBackup();
      alert('Backup exported successfully! Check your downloads folder.');
    } catch (error: any) {
      alert(`Error exporting backup: ${error.message}`);
    }
  };

  const handleMigrate = async () => {
    if (
      !confirm(
        'This will migrate all data from IndexedDB to Supabase. Make sure you have exported a backup first. Continue?'
      )
    ) {
      return;
    }

    setLoading(true);
    setMigrationResult(null);

    try {
      const result = await migrateToSupabase();
      setMigrationResult(result);

      if (result.success) {
        await checkStatus();
      }
    } catch (error: any) {
      setMigrationResult({
        success: false,
        message: `Migration failed: ${error.message}`,
        details: {
          orders: 0,
          drivers: 0,
          sheets: 0,
          distributions: 0,
          logs: 0,
          whatsappMessages: 0,
          config: false,
        },
        errors: [error.message],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Database Migration
            </h1>
            <p className="text-gray-600">
              Migrate your data from IndexedDB to Supabase
            </p>
          </div>

          {/* Migration Status */}
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Migration Status
            </h2>

            {checking ? (
              <div className="flex items-center gap-2 text-gray-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Checking status...
              </div>
            ) : migrationStatus ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm font-medium">IndexedDB Data</span>
                  {migrationStatus.hasIndexedDBData ? (
                    <span className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Data Found
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-gray-500">
                      <XCircle className="w-4 h-4" />
                      No Data
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm font-medium">Supabase Data</span>
                  {migrationStatus.hasSupabaseData ? (
                    <span className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Data Found
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-gray-500">
                      <XCircle className="w-4 h-4" />
                      No Data
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm font-medium">Migration Status</span>
                  {migrationStatus.hasMigrated ? (
                    <span className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Completed
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-yellow-600">
                      <AlertCircle className="w-4 h-4" />
                      Not Migrated
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-gray-600">Unable to check status</div>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Backup */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-600" />
                1. Export Backup
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Export your IndexedDB data as a backup before migration
              </p>
              <button
                onClick={handleExportBackup}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Export Backup
              </button>
            </div>

            {/* Migrate */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Upload className="w-5 h-5 text-green-600" />
                2. Run Migration
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Migrate all data to Supabase (requires backup first)
              </p>
              <button
                onClick={handleMigrate}
                disabled={loading || migrationStatus?.hasMigrated}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Migrating...
                  </span>
                ) : migrationStatus?.hasMigrated ? (
                  'Already Migrated'
                ) : (
                  'Start Migration'
                )}
              </button>
            </div>
          </div>

          {/* Migration Result */}
          {migrationResult && (
            <div
              className={`rounded-lg shadow p-6 mb-6 ${
                migrationResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <h3
                className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                  migrationResult.success ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {migrationResult.success ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                {migrationResult.message}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-sm">
                  <span className="text-gray-600">Orders:</span>{' '}
                  <span className="font-medium">{migrationResult.details.orders}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Drivers:</span>{' '}
                  <span className="font-medium">{migrationResult.details.drivers}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Sheets:</span>{' '}
                  <span className="font-medium">{migrationResult.details.sheets}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Distributions:</span>{' '}
                  <span className="font-medium">{migrationResult.details.distributions}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Logs:</span>{' '}
                  <span className="font-medium">{migrationResult.details.logs}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">WhatsApp Messages:</span>{' '}
                  <span className="font-medium">{migrationResult.details.whatsappMessages}</span>
                </div>
              </div>

              {migrationResult.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-red-800 mb-2">Errors:</h4>
                  <ul className="list-disc list-inside text-sm text-red-700">
                    {migrationResult.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Migration Instructions</h3>

            <div className="space-y-4 text-sm text-gray-700">
              <div>
                <h4 className="font-semibold mb-1">Before Migration:</h4>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Set up your Supabase project</li>
                  <li>Update .env.local with Supabase credentials</li>
                  <li>Run SQL schema in Supabase</li>
                  <li>Create storage bucket "order-attachments"</li>
                  <li>Export backup using the button above</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-1">After Migration:</h4>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Verify data in Supabase dashboard</li>
                  <li>Test all features in the app</li>
                  <li>Keep backup for 30 days</li>
                  <li>Monitor for any issues</li>
                </ol>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
                <p className="text-blue-800">
                  <strong>Note:</strong> The app is now configured to use Supabase.
                  IndexedDB data will remain on your device but won't be used anymore.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

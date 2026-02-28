'use client';

import React, { useEffect, useState } from 'react';
import { Zone, District } from '@/types';
import { ChevronDown } from 'lucide-react';

interface ZoneDistrictSelectorProps {
  value?: { zone_id?: string; district_id?: string; zone_name?: string; district_name?: string } | string;
  onChange: (value: { zone_id: string; district_id: string } | null) => void;
  zones: Array<Zone & { districts: District[] }>;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function ZoneDistrictSelector({
  value,
  onChange,
  zones,
  required = false,
  disabled = false,
  className = '',
}: ZoneDistrictSelectorProps) {
  // Handle both object and string values for backward compatibility
  const zoneIdFromValue = typeof value === 'object' ? value?.zone_id : undefined;
  const districtIdFromValue = typeof value === 'object' ? value?.district_id : undefined;

  const [selectedZoneId, setSelectedZoneId] = useState<string>(zoneIdFromValue || '');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(districtIdFromValue || '');
  const [availableDistricts, setAvailableDistricts] = useState<District[]>([]);

  // Update available districts when zone changes
  useEffect(() => {
    if (selectedZoneId) {
      const selectedZone = zones.find((z) => z.id === selectedZoneId);
      setAvailableDistricts(selectedZone?.districts || []);
    } else {
      setAvailableDistricts([]);
      setSelectedDistrictId('');
    }
  }, [selectedZoneId, zones]);

  // Sync with external value changes
  useEffect(() => {
    const newZoneId = typeof value === 'object' ? value?.zone_id : undefined;
    const newDistrictId = typeof value === 'object' ? value?.district_id : undefined;

    if (newZoneId !== selectedZoneId) {
      setSelectedZoneId(newZoneId || '');
    }
    if (newDistrictId !== selectedDistrictId) {
      setSelectedDistrictId(newDistrictId || '');
    }
  }, [value]);

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newZoneId = e.target.value;
    setSelectedZoneId(newZoneId);
    setSelectedDistrictId(''); // Reset district when zone changes

    if (!newZoneId) {
      onChange(null);
    }
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDistrictId = e.target.value;
    setSelectedDistrictId(newDistrictId);

    if (selectedZoneId && newDistrictId) {
      onChange({ zone_id: selectedZoneId, district_id: newDistrictId });
    } else {
      onChange(null);
    }
  };

  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const selectedDistrict = availableDistricts.find((d) => d.id === selectedDistrictId);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Zone Selector */}
      <div className="relative">
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Zone {required && <span className="text-red-400">*</span>}
        </label>
        <div className="relative">
          <select
            value={selectedZoneId}
            onChange={handleZoneChange}
            disabled={disabled}
            required={required}
            className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2.5 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
          >
            <option value="">Select a zone...</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
        </div>
      </div>

      {/* District Selector */}
      <div className="relative">
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          District {required && <span className="text-red-400">*</span>}
        </label>
        <div className="relative">
          <select
            value={selectedDistrictId}
            onChange={handleDistrictChange}
            disabled={disabled || !selectedZoneId}
            required={required}
            className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2.5 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
          >
            <option value="">
              {selectedZoneId ? 'Select a district...' : 'Select a zone first'}
            </option>
            {availableDistricts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
        </div>
      </div>

      {/* Visual Feedback */}
      {selectedZone && selectedDistrict && (
        <div className="flex items-center gap-2 text-sm text-zinc-400 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400 font-medium">{selectedZone.name}</span>
            <span>→</span>
            <span className="text-blue-400 font-medium">{selectedDistrict.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

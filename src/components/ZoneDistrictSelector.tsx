'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Zone, District, SpecialZone } from '@/types';
import { Search, X, MapPin, Star } from 'lucide-react';

const SPECIAL_ZONE_PREFIX = 'special::';

interface ZoneDistrictSelectorProps {
  value?: { zone_id?: string; district_id?: string; zone_name?: string; district_name?: string } | string;
  onChange: (value: { zone_id: string; district_id: string } | null) => void;
  zones: Array<Zone & { districts: District[] }>;
  specialZones?: SpecialZone[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

interface SearchItem {
  type: 'district' | 'special';
  label: string;            // district name (or special zone name)
  zoneName: string;         // parent zone name
  zone_id: string;
  district_id: string;
  specialZone?: SpecialZone;
}

export default function ZoneDistrictSelector({
  value,
  onChange,
  zones,
  specialZones = [],
  required = false,
  disabled = false,
  className = '',
}: ZoneDistrictSelectorProps) {
  const zoneIdFromValue = typeof value === 'object' ? value?.zone_id : undefined;
  const districtIdFromValue = typeof value === 'object' ? value?.district_id : undefined;

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build flat searchable list of all districts + special zones
  const allItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];
    for (const zone of zones) {
      for (const district of zone.districts) {
        items.push({
          type: 'district',
          label: district.name,
          zoneName: zone.name,
          zone_id: zone.id,
          district_id: district.id,
        });
      }
    }
    for (const sz of specialZones) {
      items.push({
        type: 'special',
        label: sz.name,
        zoneName: 'Special Zone',
        zone_id: `${SPECIAL_ZONE_PREFIX}${sz.id}`,
        district_id: '',
        specialZone: sz,
      });
    }
    return items;
  }, [zones, specialZones]);

  // Filter items by query
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.zoneName.toLowerCase().includes(q)
    );
  }, [query, allItems]);

  // Resolve current selection to display text
  const selectedDisplay = useMemo(() => {
    if (!zoneIdFromValue) return null;

    if (zoneIdFromValue.startsWith(SPECIAL_ZONE_PREFIX)) {
      const szId = zoneIdFromValue.replace(SPECIAL_ZONE_PREFIX, '');
      const sz = specialZones.find((s) => s.id === szId);
      return sz ? { label: sz.name, zoneName: 'Special Zone', type: 'special' as const } : null;
    }

    const zone = zones.find((z) => z.id === zoneIdFromValue);
    if (!zone) return null;
    const district = zone.districts.find((d) => d.id === districtIdFromValue);
    if (!district) return null;
    return { label: district.name, zoneName: zone.name, type: 'district' as const };
  }, [zoneIdFromValue, districtIdFromValue, zones, specialZones]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
        setHighlightIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.children[highlightIndex] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const selectItem = useCallback((item: SearchItem) => {
    onChange({ zone_id: item.zone_id, district_id: item.district_id });
    setIsOpen(false);
    setQuery('');
    setHighlightIndex(-1);
    inputRef.current?.blur();
  }, [onChange]);

  const clearSelection = useCallback(() => {
    onChange(null);
    setQuery('');
    setHighlightIndex(-1);
  }, [onChange]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          selectItem(filtered[highlightIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setQuery('');
        setHighlightIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }

  const hasSelection = !!selectedDisplay;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
        Zone / District {required && <span className="text-red-400">*</span>}
      </label>

      {/* Search input / selected display */}
      <div className="relative">
        {hasSelection && !isOpen ? (
          // Show selected value
          <div
            className={`w-full bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-2.5 text-white flex items-center justify-between gap-2 ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            onClick={() => {
              if (!disabled) {
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 0);
              }
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {selectedDisplay.type === 'special' ? (
                <Star className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span className="font-medium truncate">{selectedDisplay.label}</span>
              <span className="text-zinc-400 text-sm truncate">— {selectedDisplay.zoneName}</span>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelection();
                }}
                className="text-zinc-400 hover:text-white shrink-0 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          // Search input
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
                setHighlightIndex(-1);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder="Search district or zone..."
              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {hasSelection && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setQuery('');
                  setHighlightIndex(-1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl max-h-64 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-zinc-400">No results found</div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={`${item.zone_id}-${item.district_id}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectItem(item);
                }}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  idx === highlightIndex ? 'bg-zinc-700' : 'hover:bg-zinc-700/50'
                }`}
              >
                {item.type === 'special' ? (
                  <Star className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
                  <span className="text-white font-medium truncate">{item.label}</span>
                  <span className="text-zinc-400 text-xs shrink-0">{item.zoneName}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Visual feedback */}
      {selectedDisplay && !isOpen && (
        <div className="flex items-center gap-2 text-sm text-zinc-400 pt-1.5">
          {selectedDisplay.type === 'special' ? (
            <>
              <span className="text-amber-400 font-medium">{selectedDisplay.label}</span>
              <span className="text-[10px] text-zinc-500">(Special Zone)</span>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-medium">{selectedDisplay.zoneName}</span>
              <span>→</span>
              <span className="text-blue-400 font-medium">{selectedDisplay.label}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

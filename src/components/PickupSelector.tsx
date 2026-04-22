'use client';

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Search, X, Building2, Star, Plus } from 'lucide-react';
import type { Client } from '@/types';

interface PickupSelectorProps {
  clients: Client[];
  value?: string;
  onSelect: (client: Client) => void;
  onClear: () => void;
  onQuickAdd: (companyName: string) => void;
  disabled?: boolean;
}

export default function PickupSelector({
  clients,
  value,
  onSelect,
  onClear,
  onQuickAdd,
  disabled = false,
}: PickupSelectorProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedClient = useMemo(
    () => (value ? clients.find((c) => c.id === value) : null),
    [value, clients]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return clients;
    const q = query.toLowerCase().trim();
    return clients.filter(
      (c) =>
        c.company_name.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q) ||
        c.area?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [query, clients]);

  const showQuickAdd = query.trim().length > 0 && filtered.length === 0;

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

  useEffect(() => {
    if (highlightIndex >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.children[highlightIndex] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const selectItem = useCallback(
    (client: Client) => {
      onSelect(client);
      setIsOpen(false);
      setQuery('');
      setHighlightIndex(-1);
      inputRef.current?.blur();
    },
    [onSelect]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    const totalItems = filtered.length + (showQuickAdd ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          selectItem(filtered[highlightIndex]);
        } else if (showQuickAdd && highlightIndex === filtered.length) {
          onQuickAdd(query.trim());
          setIsOpen(false);
          setQuery('');
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

  return (
    <div ref={containerRef} className="relative">
      {selectedClient && !isOpen ? (
        <div
          className={`w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 flex items-center justify-between gap-2 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-zinc-600'
          } transition-colors`}
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-sm font-medium truncate">{selectedClient.company_name}</span>
            {selectedClient.is_default_pickup && (
              <Star className="w-3 h-3 text-amber-400 shrink-0" />
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="text-zinc-500 hover:text-zinc-200 shrink-0 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
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
            placeholder="Search pickup company..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-zinc-200 text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:border-emerald-500 focus:ring-emerald-500/30 transition-colors"
          />
          {selectedClient && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setQuery('');
                setHighlightIndex(-1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl max-h-56 overflow-y-auto"
        >
          {filtered.length === 0 && !showQuickAdd && (
            <div className="px-3 py-2.5 text-sm text-zinc-500">No clients found</div>
          )}
          {filtered.map((client, idx) => (
            <div
              key={client.id}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(client);
              }}
              onMouseEnter={() => setHighlightIndex(idx)}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                idx === highlightIndex ? 'bg-zinc-700' : 'hover:bg-zinc-700/50'
              }`}
            >
              <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-zinc-200 font-medium truncate">{client.company_name}</span>
                  {client.is_default_pickup && (
                    <Star className="w-3 h-3 text-amber-400 shrink-0" />
                  )}
                </div>
                {(client.area || client.state) && (
                  <p className="text-[10px] text-zinc-500 truncate">
                    {[client.area, client.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              {client.phone && (
                <span className="text-[10px] text-zinc-600 font-mono shrink-0">{client.phone}</span>
              )}
            </div>
          ))}
          {showQuickAdd && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                onQuickAdd(query.trim());
                setIsOpen(false);
                setQuery('');
              }}
              onMouseEnter={() => setHighlightIndex(filtered.length)}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-t border-zinc-700 transition-colors ${
                highlightIndex === filtered.length ? 'bg-zinc-700' : 'hover:bg-zinc-700/50'
              }`}
            >
              <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-sm text-emerald-400">
                Add &quot;{query.trim()}&quot; as new client
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

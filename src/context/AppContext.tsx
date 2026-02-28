'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppConfig, AppCache, LogEntry, Order, Driver, DistributionResult, ZoneWithDistricts } from '@/types';
import * as db from '@/lib/db-supabase';
import { getZonesWithDistricts } from '@/lib/db-zones';

interface AppContextState {
    config: AppConfig;
    cache: AppCache;
    logs: LogEntry[];
    isLoading: boolean;
}

type AppAction =
    | { type: 'SET_CONFIG'; payload: AppConfig }
    | { type: 'SET_CACHE'; payload: AppCache }
    | { type: 'SET_LOGS'; payload: LogEntry[] }
    | { type: 'ADD_LOG'; payload: LogEntry }
    | { type: 'SET_ORDERS'; payload: Order[] }
    | { type: 'SET_DRIVERS'; payload: Driver[] }
    | { type: 'SET_ZONES'; payload: ZoneWithDistricts[] }
    | { type: 'SET_DISTRIBUTION'; payload: DistributionResult }
    | { type: 'SET_ADMIN_NUMBERS'; payload: string[] }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'CLEAR_LOGS' };

const initialState: AppContextState = {
    config: {
        adminNumbers: [],
        manualDrivers: [],
        whatsappConnected: false,
        messageTemplates: [],
    },
    cache: {
        orders: [],
        drivers: [],
        zones: [],
        lastDistribution: null,
        lastFetch: null,
    },
    logs: [],
    isLoading: true,
};

function appReducer(state: AppContextState, action: AppAction): AppContextState {
    switch (action.type) {
        case 'SET_CONFIG':
            return { ...state, config: action.payload };
        case 'SET_CACHE':
            return { ...state, cache: action.payload };
        case 'SET_LOGS':
            return { ...state, logs: action.payload };
        case 'ADD_LOG':
            return { ...state, logs: [action.payload, ...state.logs].slice(0, 500) };
        case 'SET_ORDERS':
            return {
                ...state,
                cache: { ...state.cache, orders: action.payload, lastFetch: new Date().toISOString() },
            };
        case 'SET_DRIVERS':
            return { ...state, cache: { ...state.cache, drivers: action.payload } };
        case 'SET_ZONES':
            return { ...state, cache: { ...state.cache, zones: action.payload } };
        case 'SET_DISTRIBUTION':
            return { ...state, cache: { ...state.cache, lastDistribution: action.payload } };
        case 'SET_ADMIN_NUMBERS':
            return { ...state, config: { ...state.config, adminNumbers: action.payload } };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'CLEAR_LOGS':
            return { ...state, logs: [] };
        default:
            return state;
    }
}

interface AppContextValue extends AppContextState {
    dispatch: React.Dispatch<AppAction>;
    addLog: (type: LogEntry['type'], message: string, details?: string) => void;
    saveData: () => void;
    saveAdminNumbers: (numbers: string[]) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    // Load data from IndexedDB on mount
    useEffect(() => {
        async function loadData() {
            try {
                const config = await db.getConfig();
                const orders = await db.getAllOrders();
                const drivers = await db.getAllDrivers();
                const zones = await getZonesWithDistricts(true);
                const latestDist = await db.getLatestDistribution();
                const logs = await db.getAllLogs();

                dispatch({ type: 'SET_CONFIG', payload: config });
                dispatch({
                    type: 'SET_CACHE',
                    payload: {
                        orders,
                        drivers,
                        zones,
                        lastDistribution: latestDist || null,
                        lastFetch: new Date().toISOString(),
                    },
                });
                dispatch({ type: 'SET_LOGS', payload: logs });
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        }
        loadData();
    }, []);

    // Save config to DB (orders/drivers are managed directly via db-supabase, not overwritten here)
    const saveData = async () => {
        try {
            await db.saveConfig(state.config);
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    };

    // Persist admin numbers to DB immediately + update state
    const saveAdminNumbers = async (numbers: string[]) => {
        dispatch({ type: 'SET_ADMIN_NUMBERS', payload: numbers });
        try {
            await db.saveConfig({ ...state.config, adminNumbers: numbers });
        } catch (error) {
            console.error('Failed to save admin numbers:', error);
        }
    };

    // Helper to add logs
    const addLog = async (type: LogEntry['type'], message: string, details?: string) => {
        try {
            const entry = await db.addLog({ type, message, details });
            dispatch({ type: 'ADD_LOG', payload: entry });
        } catch (error) {
            console.error('Failed to add log:', error);
        }
    };

    // Auto-save config changes only (not cache — orders/drivers are managed directly via db-supabase)
    useEffect(() => {
        if (!state.isLoading) {
            db.saveConfig(state.config).catch(err =>
                console.error('Failed to auto-save config:', err)
            );
        }
    }, [state.config, state.isLoading]);

    return (
        <AppContext.Provider value={{ ...state, dispatch, addLog, saveData, saveAdminNumbers }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
}

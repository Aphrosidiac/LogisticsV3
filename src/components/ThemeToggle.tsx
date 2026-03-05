'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
    const [dark, setDark] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('theme');
        const isDark = stored !== 'light';
        setDark(isDark);
        document.documentElement.classList.toggle('light', !isDark);
        document.documentElement.classList.toggle('dark', isDark);
        setMounted(true);
    }, []);

    function toggle() {
        const next = !dark;
        setDark(next);
        localStorage.setItem('theme', next ? 'dark' : 'light');
        document.documentElement.classList.toggle('light', !next);
        document.documentElement.classList.toggle('dark', next);
    }

    if (!mounted) return null;

    return (
        <button
            onClick={toggle}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
        >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
    );
}

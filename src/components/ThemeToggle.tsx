'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

function getInitialTheme(): boolean {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('theme') !== 'light';
}

export default function ThemeToggle() {
    const [dark, setDark] = useState(getInitialTheme);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        document.documentElement.classList.toggle('light', !dark);
        document.documentElement.classList.toggle('dark', dark);
    }, [dark]);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setMounted(true); }, []);

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

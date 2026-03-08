'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileText } from 'lucide-react';

interface DOViewerModalProps {
    url: string;
    filename: string;
    onClose: () => void;
}

function isImage(filename: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
}

function isPDF(filename: string): boolean {
    return /\.pdf$/i.test(filename);
}

function shortName(filename: string): string {
    // Extract just the original filename from a Supabase storage path like
    // "orderId/1234567890-original_name.pdf"
    const parts = filename.split('/');
    const last = parts[parts.length - 1];
    // Remove the timestamp prefix "1234567890-"
    return last.replace(/^\d+-/, '');
}

export default function DOViewerModal({ url, filename, onClose }: DOViewerModalProps) {
    const displayName = shortName(filename);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [onClose]);

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 modal-backdrop backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700 bg-zinc-800/60 shrink-0">
                    <span className="text-sm font-medium text-zinc-200 truncate mr-4" title={displayName}>
                        {displayName}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                        <a
                            href={url}
                            download={displayName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                            onClick={e => e.stopPropagation()}
                        >
                            <Download className="w-3.5 h-3.5" />
                            Download
                        </a>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto flex items-center justify-center bg-zinc-950 min-h-0">
                    {isImage(displayName) ? (
                        <img
                            src={url}
                            alt={displayName}
                            className="max-w-full max-h-[75vh] object-contain p-4"
                        />
                    ) : isPDF(displayName) ? (
                        <iframe
                            src={url}
                            title={displayName}
                            className="w-full h-[75vh] border-0"
                        />
                    ) : (
                        <div className="text-center p-12">
                            <FileText className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                            <p className="text-zinc-400 mb-6 text-sm">Preview not available for this file type.</p>
                            <a
                                href={url}
                                download={displayName}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Download to view
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

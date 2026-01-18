'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatDistributionMessage } from '@/lib/distribution';
import { formatPhoneNumber, validatePhoneNumber } from '@/lib/utils';
import PhoneChip from '@/components/PhoneChip';
import Modal from '@/components/Modal';
import {
    Settings,
    Phone,
    Plus,
    Send,
    Copy,
    ExternalLink,
    Check,
    AlertCircle,
    CheckCircle2,
    MessageSquare,
} from 'lucide-react';

export default function AdminPage() {
    const { config, cache, dispatch, addLog } = useApp();
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleAddPhone = () => {
        const cleaned = formatPhoneNumber(phoneInput);

        if (!validatePhoneNumber(cleaned)) {
            setPhoneError('Please enter a valid phone number (10-15 digits)');
            return;
        }

        if (config.adminNumbers.includes(cleaned)) {
            setPhoneError('This number is already added');
            return;
        }

        dispatch({
            type: 'SET_ADMIN_NUMBERS',
            payload: [...config.adminNumbers, cleaned],
        });

        addLog('info', `Added admin number: ${cleaned}`);
        setPhoneInput('');
        setPhoneError(null);
    };

    const handleRemovePhone = (phone: string) => {
        dispatch({
            type: 'SET_ADMIN_NUMBERS',
            payload: config.adminNumbers.filter((p) => p !== phone),
        });
        addLog('info', `Removed admin number: ${phone}`);
    };

    const getDistributionMessage = () => {
        if (!cache.lastDistribution) return '';
        return formatDistributionMessage(cache.lastDistribution);
    };

    const handleCopyMessage = async () => {
        const message = getDistributionMessage();
        try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            addLog('success', 'Distribution report copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            addLog('error', 'Failed to copy to clipboard');
        }
    };

    const handleShareWhatsApp = (phone?: string) => {
        const message = encodeURIComponent(getDistributionMessage());
        const url = phone
            ? `https://wa.me/${phone}?text=${message}`
            : `https://wa.me/?text=${message}`;
        window.open(url, '_blank');
        addLog('info', phone ? `Opened WhatsApp for ${phone}` : 'Opened WhatsApp share');
    };

    const canSend = cache.lastDistribution && config.adminNumbers.length > 0;

    // Requirements check
    const requirements = [
        {
            label: 'Distribution calculated',
            met: !!cache.lastDistribution,
        },
        {
            label: 'Admin numbers added',
            met: config.adminNumbers.length > 0,
        },
    ];

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Admin Settings</h1>
                <p className="text-zinc-500 mt-1">
                    Manage admin phone numbers and send distribution notifications
                </p>
            </div>

            {/* Phone Numbers */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-blue-400" />
                    Admin Phone Numbers
                </h2>

                {/* Add Phone Input */}
                <div className="flex gap-3 mb-4">
                    <input
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => {
                            setPhoneInput(e.target.value);
                            setPhoneError(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddPhone()}
                        placeholder="e.g., 60123456789 (include country code)"
                        className="input flex-1"
                    />
                    <button
                        onClick={handleAddPhone}
                        disabled={!phoneInput.trim()}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Add
                    </button>
                </div>

                {phoneError && (
                    <p className="text-sm text-rose-400 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {phoneError}
                    </p>
                )}

                {/* Phone Chips */}
                {config.adminNumbers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {config.adminNumbers.map((phone) => (
                            <PhoneChip key={phone} phone={phone} onRemove={handleRemovePhone} />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-zinc-500">No admin numbers added yet</p>
                )}
            </div>

            {/* Requirements */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Requirements</h2>
                <div className="space-y-3">
                    {requirements.map((req) => (
                        <div key={req.label} className="flex items-center gap-3">
                            {req.met ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-zinc-500" />
                            )}
                            <span className={req.met ? 'text-zinc-200' : 'text-zinc-500'}>
                                {req.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Send Notification */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    Send Notification
                </h2>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowPreview(true)}
                        disabled={!cache.lastDistribution}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <MessageSquare className="w-5 h-5" />
                        Preview Message
                    </button>

                    <button
                        onClick={handleCopyMessage}
                        disabled={!cache.lastDistribution}
                        className="btn-secondary flex items-center gap-2"
                    >
                        {copied ? (
                            <>
                                <Check className="w-5 h-5 text-emerald-400" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="w-5 h-5" />
                                Copy to Clipboard
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => handleShareWhatsApp()}
                        disabled={!cache.lastDistribution}
                        className="btn-primary flex items-center gap-2"
                    >
                        <ExternalLink className="w-5 h-5" />
                        Open WhatsApp
                    </button>
                </div>

                {/* Quick Send to Specific Numbers */}
                {canSend && (
                    <div className="mt-6 pt-6 border-t border-zinc-800">
                        <h3 className="text-sm font-medium text-zinc-400 mb-3">
                            Send directly to admin numbers:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {config.adminNumbers.map((phone) => (
                                <button
                                    key={phone}
                                    onClick={() => handleShareWhatsApp(phone)}
                                    className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors flex items-center gap-2 text-sm"
                                >
                                    <Send className="w-4 h-4" />
                                    {phone}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Message Preview Modal */}
            <Modal
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                title="Message Preview"
                size="lg"
                footer={
                    <>
                        <button
                            onClick={() => setShowPreview(false)}
                            className="btn-secondary"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                handleCopyMessage();
                                setShowPreview(false);
                            }}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Copy className="w-5 h-5" />
                            Copy Message
                        </button>
                    </>
                }
            >
                <pre className="bg-zinc-800 p-4 rounded-xl text-sm text-zinc-300 whitespace-pre-wrap font-mono overflow-auto max-h-96">
                    {getDistributionMessage() || 'No distribution available'}
                </pre>
            </Modal>
        </div>
    );
}

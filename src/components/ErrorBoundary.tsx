'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                    <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-red-100 rounded-lg">
                                <AlertTriangle className="w-8 h-8 text-red-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    Something went wrong
                                </h1>
                                <p className="text-gray-600 mt-1">
                                    The application encountered an unexpected error
                                </p>
                            </div>
                        </div>

                        {this.state.error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                                <h2 className="font-semibold text-red-900 mb-2">
                                    Error Details:
                                </h2>
                                <p className="text-red-800 font-mono text-sm">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <details className="mt-3">
                                        <summary className="cursor-pointer text-red-700 text-sm font-medium">
                                            Component Stack Trace
                                        </summary>
                                        <pre className="mt-2 text-xs text-red-700 overflow-auto max-h-64 p-2 bg-red-100 rounded">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                Go to Dashboard
                            </button>
                        </div>

                        <div className="mt-6 text-sm text-gray-600">
                            <p>
                                If this problem persists, please try:
                            </p>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Refreshing the page</li>
                                <li>Clearing your browser cache</li>
                                <li>Checking the console for more details</li>
                            </ul>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

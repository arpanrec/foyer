import React, { type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryState = {
    error: Error | null;
    errorInfo: ErrorInfo | null;
};

export default class ErrorBoundary extends React.Component<{ children?: ReactNode }, ErrorBoundaryState> {
    constructor(props: { children?: ReactNode }) {
        super(props);
        this.state = { error: null, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Catch errors in any components below and re-render with error message
        this.setState({
            error,
            errorInfo,
        });

        // You can also log error messages to an error reporting service here
        if (error || errorInfo) {
            console.error("component error: %s, info: %s", error, errorInfo);
        }
    }

    render() {
        const { error, errorInfo } = this.state;
        if (errorInfo) {
            // Error path
            return (
                <div className="inline-block text-sm bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100 rounded-md p-2 m-1">
                    <div className="font-medium mb-1">Something went wrong.</div>
                    <details className="text-xs font-mono whitespace-pre">
                        <summary>{error && error.toString()}</summary>
                        {errorInfo.componentStack}
                    </details>
                </div>
            );
        }

        // Normally, just render children
        const { children } = this.props;
        return children;
    }
}

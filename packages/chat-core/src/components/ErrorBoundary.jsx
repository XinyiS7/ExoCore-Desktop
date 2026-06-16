import React from 'react';
import { AlertTriangle, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      // Default fallback UI
      return (
        <div className="flex items-center justify-center h-full bg-chat-bg">
          <div className="text-center space-y-4 px-6 max-w-md">
            <AlertTriangle size={40} className="text-chat-accent/60 mx-auto" />
            <h2 className="text-sm font-semibold text-chat-text/80">
              Something went wrong
            </h2>
            <p className="text-xs text-chat-muted/60 font-mono leading-relaxed break-all">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-xs font-medium rounded border border-chat-accent/30 text-chat-accent hover:bg-chat-accent/10 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-4 py-2 text-xs font-medium rounded border border-white/10 text-chat-muted hover:bg-exo-accent/[0.04] transition-colors flex items-center gap-1.5"
              >
                <Home size={13} /> Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

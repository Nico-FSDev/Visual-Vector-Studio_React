import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#121212] p-6 text-white font-sans">
          <div className="max-w-xl w-full bg-[#1e1e1e] border border-red-900/50 rounded-xl p-8 shadow-2xl">
            <div className="flex items-center gap-4 text-red-500 mb-6">
              <AlertTriangle className="w-10 h-10" />
              <h1 className="text-2xl font-bold">Erreur de l'application</h1>
            </div>

            <div className="bg-[#121212] rounded-lg p-4 mb-6 overflow-auto max-h-60 border border-neutral-800">
              <p className="text-red-400 font-mono text-sm font-bold mb-2">
                {this.state.error && this.state.error.toString()}
              </p>
              <pre className="text-neutral-500 font-mono text-xs whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack || this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full py-3 px-4 bg-[#f05a28] hover:bg-[#ff6d39] text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-5 h-5" />
              Réinitialiser et recharger
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

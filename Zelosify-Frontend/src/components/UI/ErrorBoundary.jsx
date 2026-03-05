"use client";
import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * ErrorBoundary — catches unhandled render errors in the subtree.
 * Wrap any page section that could throw (data-dependent renders,
 * third-party component crashes, etc.).
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
          <AlertTriangle className="w-10 h-10 text-red-500 opacity-80" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">
              {this.props.title ?? "Something went wrong"}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {this.props.description ??
                "An unexpected error occurred. Try refreshing or go back."}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

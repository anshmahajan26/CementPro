import { Component } from "react";

/**
 * Generic ErrorBoundary — catches render errors in its children and shows
 * a graceful fallback instead of crashing the entire page.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex h-full items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          ⚠ Component failed to render. {String(this.state.error?.message || "")}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

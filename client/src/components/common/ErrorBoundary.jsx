import { Component } from 'react';

// Catches render/commit errors in its subtree so a single broken component can
// never white-screen the whole app. Shows a recoverable panel (with the error
// text, so issues are diagnosable instead of an invisible blank) and resets
// automatically when the route changes.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface it for debugging (and any future Sentry wiring).
    console.error('UI ErrorBoundary caught:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Auto-recover when the user navigates to a different route.
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-8 min-h-[60vh]">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Something went wrong on this screen</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">
            The rest of the app is still working — you can go back, or reload this view.
          </p>
          <pre className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 max-w-lg overflow-auto mb-4 text-left">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

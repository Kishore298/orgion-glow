import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
          <h1 className="font-serif text-3xl text-primary-dark">Something went gently awry</h1>
          <p className="mt-2 text-sm text-text-muted max-w-md">
            Please refresh the page to continue exploring ORGION.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary mt-6"
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import React from 'react'

/**
 * A React component that silences errors produced by its children.
 *
 * When an error occurs in a child component, this boundary catches it and
 * renders nothing (null) instead of crashing the entire component tree.
 * It resets its error state when new children are provided (via key changes
 * or parent re-renders).
 */
export default class SilencingErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch = () => {
    // Silently catch the error - no logging or reporting
  }

  componentDidUpdate(prevProps) {
    // Reset error state when children change to allow recovery
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return null
    }

    return this.props.children
  }
}

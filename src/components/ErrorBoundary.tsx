import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

/** Keeps the map up if the callout ever throws; the callout is simply left out. */
export default class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Callout failed to render', error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

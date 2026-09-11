import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Without this, an uncaught render error (e.g. a missing env var throwing at
 * module init) unmounts the whole React tree and leaves a blank white page
 * with nothing but a console error -- unusable for anyone who isn't looking
 * at devtools. This at least shows the message so it's diagnosable in the field.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught error rendering app:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 480, margin: "80px auto", padding: 24, fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ marginBottom: 16, color: "#555" }}>{this.state.error.message}</p>
          <button
            onClick={() => location.reload()}
            style={{ padding: "8px 16px", background: "#c1440e", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import React from "react";

type AppErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return {
      hasError: true,
      errorMessage: message,
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error("App runtime error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          style={{
            minHeight: "100dvh",
            background:
              "#f5f2ea",
            color: "#1a1a1a",
            padding: "24px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "720px",
              margin: "0 auto",
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)",
            }}
          >
            <p style={{ fontSize: "12px", letterSpacing: "0.12em", opacity: 0.75 }}>
              STARTUP ERROR
            </p>
            <h1 style={{ fontSize: "28px", margin: "12px 0 16px" }}>
              The app hit a runtime error during launch.
            </h1>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "rgba(203,184,146,0.12)",
                border: "1px solid rgba(203,184,146,0.18)",
                borderRadius: "20px",
                padding: "16px",
                color: "#f5ecd8",
              }}
            >
              {this.state.errorMessage}
            </pre>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

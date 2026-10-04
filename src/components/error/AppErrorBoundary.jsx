import React from "react";

function normalizeError(error) {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string" && error.trim()) {
    return new Error(error);
  }

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error("An unknown application error occurred.");
  }
}

function ErrorPanel({ error, boot = false }) {
  const message = normalizeError(error).message || "An unknown application error occurred.";
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  const goBack = () => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    window.location.assign("/");
  };

  const goHome = () => {
    window.location.assign("/");
  };

  const reload = () => {
    window.location.reload();
  };

  return (
    <main
      role="alert"
      style={{
        boxSizing: "border-box",
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        background:
          "radial-gradient(circle at top, rgba(65, 105, 225, 0.12), transparent 34%), #0b1020",
        color: "#e8edf7",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          width: "min(100%, 720px)",
          boxSizing: "border-box",
          padding: "32px",
          border: "1px solid rgba(148, 163, 184, 0.18)",
          borderRadius: "20px",
          background: "rgba(17, 24, 39, 0.88)",
          boxShadow: "0 24px 70px rgba(2, 8, 23, 0.42)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            display: "grid",
            placeItems: "center",
            borderRadius: 14,
            marginBottom: 18,
            background: "rgba(248, 113, 113, 0.12)",
            border: "1px solid rgba(248, 113, 113, 0.18)",
            color: "#fca5a5",
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          !
        </div>

        <p
          style={{
            margin: "0 0 8px",
            color: "#8ab4ff",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          PaaSDeployer
        </p>

        <h1
          style={{
            margin: 0,
            color: "#f8fafc",
            fontSize: "clamp(1.9rem, 4vw, 2.6rem)",
            lineHeight: 1.08,
            letterSpacing: "-0.035em",
          }}
        >
          {boot ? "We couldn't load the application" : "Something went wrong"}
        </h1>

        <p
          style={{
            margin: "14px 0 0",
            color: "#a9b5c7",
            fontSize: 15,
            lineHeight: 1.7,
          }}
        >
          {boot
            ? "The browser could not finish starting the PaaSDeployer interface. You can retry or return to a safe page."
            : "This page could not be rendered correctly. Your data has not been intentionally changed by this error screen."}
        </p>

        <div
          style={{
            marginTop: 22,
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(2, 8, 23, 0.52)",
            border: "1px solid rgba(148, 163, 184, 0.14)",
          }}
        >
          <div
            style={{
              marginBottom: 6,
              color: "#cbd5e1",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Error message
          </div>
          <code
            style={{
              display: "block",
              overflowWrap: "anywhere",
              color: "#fda4af",
              fontSize: 13,
              lineHeight: 1.65,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            {message}
          </code>
        </div>

        {!boot && normalizeError(error).stack && (
          <details style={{ marginTop: 14 }}>
            <summary
              style={{
                cursor: "pointer",
                color: "#94a3b8",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Technical details
            </summary>
            <pre
              style={{
                margin: "10px 0 0",
                padding: 14,
                overflow: "auto",
                maxHeight: 260,
                borderRadius: 10,
                background: "rgba(2, 8, 23, 0.42)",
                color: "#94a3b8",
                fontSize: 11,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {normalizeError(error).stack}
            </pre>
          </details>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 24,
          }}
        >
          <button
            type="button"
            onClick={reload}
            style={{
              border: 0,
              borderRadius: 12,
              padding: "11px 16px",
              background: "#8ab4ff",
              color: "#081325",
              cursor: "pointer",
              font: "700 14px/1.2 Inter, system-ui, sans-serif",
            }}
          >
            Reload
          </button>

          {canGoBack && (
            <button
              type="button"
              onClick={goBack}
              style={{
                border: "1px solid rgba(148, 163, 184, 0.24)",
                borderRadius: 12,
                padding: "11px 16px",
                background: "rgba(148, 163, 184, 0.08)",
                color: "#e2e8f0",
                cursor: "pointer",
                font: "700 14px/1.2 Inter, system-ui, sans-serif",
              }}
            >
              Go back
            </button>
          )}

          <button
            type="button"
            onClick={goHome}
            style={{
              border: "1px solid rgba(148, 163, 184, 0.24)",
              borderRadius: 12,
              padding: "11px 16px",
              background: "transparent",
              color: "#cbd5e1",
              cursor: "pointer",
              font: "700 14px/1.2 Inter, system-ui, sans-serif",
            }}
          >
            Home
          </button>
        </div>
      </section>
    </main>
  );
}

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, source: null };
    this.handleWindowError = this.handleWindowError.bind(this);
    this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error: normalizeError(error), source: "react" };
  }

  componentDidMount() {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[PaaSDeployer] React render error", error, info);
    }
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  handleWindowError(event) {
    if (event?.target && event.target !== window) {
      const target = event.target;
      if (!(target instanceof HTMLScriptElement || target instanceof HTMLModuleScriptElement)) {
        return;
      }
    }

    const error =
      event?.error ||
      new Error(
        String(event?.message || "A browser runtime error prevented the application from continuing."),
      );

    this.setState({ error: normalizeError(error), source: "browser" });
  }

  handleUnhandledRejection(event) {
    const reason = event?.reason;
    this.setState({
      error: normalizeError(
        reason || "An unhandled asynchronous error stopped the application.",
      ),
      source: "promise",
    });
  }

  render() {
    if (this.state.error) {
      return <ErrorPanel error={this.state.error} />;
    }

    return this.props.children;
  }
}

export function BootErrorScreen({ error }) {
  return <ErrorPanel error={error} boot />;
}

export default AppErrorBoundary;

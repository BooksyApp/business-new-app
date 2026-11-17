import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import App from "./App.tsx";
import "./index.css";
import { t, loadHubLocale } from "@/i18n";
import { getHubLocale } from "@/lib/hubLocale";
import { initSentry, reportError } from "@/lib/sentry";
import { ImpersonationBanner, ImpersonationError } from "@/components/ImpersonationBanner";
import { handleImpersonationLanding } from "@/lib/impersonation";
import { captureInstallPrompt, registerServiceWorker } from "@/lib/pwa";

initSentry();
captureInstallPrompt();
registerServiceWorker();

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Always to the console, in every build: a crash a developer cannot see the cause of
    // takes an afternoon to find, and the console is not shown to a customer anyway.
    console.error("[booqi] render crash:", error, info?.componentStack);
    reportError(error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
          <h1>{t("main.somethingWentWrong")}</h1>
          <p>{t("main.pleaseRefreshThePageIf")}</p>
          {/* The message and stack, in development only. "Something went wrong" with
              nothing else is the least useful thing a crash can say to the person who has
              to fix it — and in production it is all a salon should see. */}
          {import.meta.env.DEV ? (
            <details open style={{ marginTop: "1.5rem" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                {this.state.error.name}: {this.state.error.message}
              </summary>
              <pre
                style={{
                  marginTop: "0.75rem",
                  padding: "1rem",
                  background: "#f6f6f7",
                  borderRadius: 8,
                  overflow: "auto",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {this.state.error.stack}
              </pre>
            </details>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in document");
}

// A panel set to a lazily bundled language (ru) loads it first, so the first paint is not
// English; az / en are in the main bundle and this resolves at once.
loadHubLocale(getHubLocale())
  // A-01: /impersonate?code=… is handled before the router exists (router-agnostic).
  .then(() => handleImpersonationLanding().catch(() => "error" as const))
  .catch(() => "none" as const)
  .then((landing) => {
    if (landing === "done") return; // navigating to the panel
    createRoot(rootElement).render(
      <ErrorBoundary>
        {landing === "error" ? (
          <ImpersonationError />
        ) : (
          <>
            <ImpersonationBanner />
            <App />
          </>
        )}
      </ErrorBoundary>
    );
  });

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import { HapticsProvider } from "./hooks/use-haptics.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN ?? "https://e1b0f6fd25fcf288cefdfe0ad4d9fc4b@o1.ingest.us.sentry.io/4510957952892928",
  // 100% trace sampling — intentional for this low-traffic demo app.
  // Reduce for high-traffic deployments.
  tracesSampleRate: 1.0,
  integrations: [Sentry.browserTracingIntegration()],
});

function ErrorFallback() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "#f4f2fa",
        fontFamily: "'Space Grotesk', sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: "0.9rem", color: "#c8c0dc" }}>
        An unexpected error occurred. Please refresh the page.
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <HapticsProvider>
        <App />
      </HapticsProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);

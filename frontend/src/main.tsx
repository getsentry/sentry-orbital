import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

Sentry.init({
  dsn: "https://e1b0f6fd25fcf288cefdfe0ad4d9fc4b@o1.ingest.us.sentry.io/4510957952892928",
  tracesSampleRate: 1.0,
  integrations: [Sentry.browserTracingIntegration()],
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";

import "./i18n/index.js";
import App from "./App.js";
import { AuthProvider } from "./auth/AuthProvider.js";
import { ToastProvider } from "./components/ToastProvider.js";
import { registerServiceWorker } from "./pwa/register.js";
import "./index.css";
import "./App.css";

// Optional Sentry client-side error reporting. Enabled only when
// VITE_SENTRY_DSN is provided at build time.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
  });
}

function SentryFallback(): ReactNode {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h2>Something went wrong</h2>
      <p>An unexpected error occurred. Please reload the page.</p>
      <button type="button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found");
}

registerServiceWorker();

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          {sentryDsn ? (
            <Sentry.ErrorBoundary fallback={<SentryFallback />}>
              <App />
            </Sentry.ErrorBoundary>
          ) : (
            <App />
          )}
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);

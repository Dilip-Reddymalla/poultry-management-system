import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./i18n/index.js";
import App from "./App.js";
import { AuthProvider } from "./auth/AuthProvider.js";
import { ToastProvider } from "./components/ToastProvider.js";
import { OfflineQueueProvider } from "./hooks/useOfflineQueue.js";
import { registerServiceWorker } from "./pwa/register.js";
import "./index.css";
import "./App.css";

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
          <OfflineQueueProvider>
            <App />
          </OfflineQueueProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);

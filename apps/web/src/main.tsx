import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { AuthProvider } from "./shared/auth/context/AuthContext";
import "@xyflow/react/dist/style.css";
import "./shared/styles/theme.css";
import "./shared/styles/index.css";
import { canonicalRedirectTarget } from "./shared/config/canonicalOrigin";

// Entrada por una dirección técnica de Vercel → a la oficial, sin pintar nada.
const redirect = canonicalRedirectTarget(window.location, import.meta.env.VITE_APP_URL);

if (redirect) {
  window.location.replace(redirect);
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

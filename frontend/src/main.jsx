import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./AuthContext";
import "./styles.css";

const theme = localStorage.getItem("rr_theme") || "dark";
const accent = localStorage.getItem("rr_accent") || "#7c5cff";
document.documentElement.dataset.theme = theme;
document.documentElement.style.setProperty("--accent", accent);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

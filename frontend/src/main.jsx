import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./AuthContext";
import "./styles.css";

const theme = localStorage.getItem("rr_theme") || "dark";
const accent = localStorage.getItem("rr_accent") || "#7c5cff";
const modalScale = localStorage.getItem("rr_modal_scale") || "1";
const cardW = localStorage.getItem("rr_card_w") || "160";
document.documentElement.dataset.theme = theme;
document.documentElement.dataset.crt = localStorage.getItem("rr_crt") === "1" ? "1" : "0";
document.documentElement.style.setProperty("--accent", accent);
document.documentElement.style.setProperty("--modal-scale", modalScale);
document.documentElement.style.setProperty("--card-w", `${cardW}px`);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

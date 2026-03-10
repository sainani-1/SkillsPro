import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { ChatProvider } from "./context/ChatContext";
import { NotificationProvider } from "./context/NotificationContext";

const suppressConsoleOutput = () => {
  const noop = () => {};
  const methods = ["error", "warn", "log", "info", "debug"];

  methods.forEach((method) => {
    if (typeof console[method] === "function") {
      console[method] = noop;
    }
  });

  window.addEventListener("error", (event) => {
    event.preventDefault();
  });

  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
  });
};

suppressConsoleOutput();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <ChatProvider>
          <App />
        </ChatProvider>
      </NotificationProvider>
    </AuthProvider>
  </React.StrictMode>
);

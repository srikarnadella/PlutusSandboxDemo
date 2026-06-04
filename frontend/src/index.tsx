import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { QuickstartProvider } from "./Context";
import { ToastProvider } from "./Components/Toast";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <QuickstartProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </QuickstartProvider>
    </BrowserRouter>
  </React.StrictMode>
);

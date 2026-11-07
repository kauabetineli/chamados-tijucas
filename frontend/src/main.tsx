import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { ativarJeitoDeApp } from "./lib/jeitoDeApp";
import { ativarDiagnostico } from "./lib/diagnostico";

ativarDiagnostico();
ativarJeitoDeApp();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

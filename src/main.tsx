import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Solo el subconjunto latino: alcanza para el castellano y hace el sitio más liviano.
import "@fontsource/shrikhand/latin-400.css";
import "@fontsource/lexend/latin-400.css";
import "@fontsource/lexend/latin-600.css";
import "@fontsource/lexend/latin-700.css";
import "./styles.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { App } from "./app/App.js";
import { UPDATE_READY_EVENT } from "./app/UpdatePrompt.js";
import "./styles/global.css";

let activateUpdate: (reloadPage?: boolean) => Promise<void>;
activateUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(
      new CustomEvent(UPDATE_READY_EVENT, {
        detail: {
          activate: () => activateUpdate(true),
        },
      }),
    );
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

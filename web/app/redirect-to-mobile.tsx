// app/redirect-to-mobile.tsx
"use client";

import { useEffect } from "react";

export default function ClientViewportRedirect() {
  useEffect(() => {
    // don’t fire if we’re already on /mobile or inside admin/api
    const path = window.location.pathname;
    if (path.startsWith("/mobile") || path.startsWith("/admin") || path.startsWith("/api")) return;

    // Viewport-based redirect for simulators (e.g., Safari Responsive Mode)
    const isSmall = window.matchMedia("(max-width: 768px)").matches;
    if (isSmall) {
      // use replace to avoid back-button loops
      window.location.replace("/mobile");
    }
  }, []);

  return null;
}

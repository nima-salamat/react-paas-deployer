import { useEffect } from "react";

export function markBootReady() {
  if (typeof window === "undefined") return;
  window.__PASSDEPLOYER_BOOT__?.markReady?.();
}

export function useBootReady() {
  useEffect(() => {
    markBootReady();
  }, []);
}

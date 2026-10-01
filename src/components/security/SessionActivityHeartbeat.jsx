import { useEffect, useRef } from "react";
import apiRequest from "../customHooks/apiRequest.jsx";
import { isSessionBoundToken } from "../customHooks/authSession.js";

const ACTIVITY_URL = () => {
  const host = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
  return `${host}/auth/api/sessions/activity/`;
};

const HEARTBEAT_MS = 30_000;
const INTERACTION_THROTTLE_MS = 15_000;

export default function SessionActivityHeartbeat() {
  const lastSentAt = useRef(0);

  useEffect(() => {
    let disposed = false;

    const pulse = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      const access = window.localStorage.getItem("access");
      if (!access || !isSessionBoundToken(access)) return;
      if (Date.now() - lastSentAt.current < 5_000) return;

      try {
        const response = await apiRequest({
          method: "POST",
          url: ACTIVITY_URL(),
          data: {},
        });
        lastSentAt.current = Date.now();
        const timestamp = response?.data?.last_seen_at;
        if (timestamp) {
          window.dispatchEvent(
            new CustomEvent("session-activity", {
              detail: { last_seen_at: timestamp },
            }),
          );
        }
      } catch {
        // apiRequest owns refresh/session invalidation. Activity failure alone
        // must not redirect or disturb the rest of the application.
      }
    };

    const onAuthChanged = () => {
      lastSentAt.current = 0;
      void pulse();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void pulse();
    };

    const onInteraction = () => {
      if (Date.now() - lastSentAt.current >= INTERACTION_THROTTLE_MS) {
        void pulse();
      }
    };

    const timer = window.setInterval(() => {
      void pulse();
    }, HEARTBEAT_MS);

    window.addEventListener("auth-changed", onAuthChanged);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onInteraction, { passive: true });
    window.addEventListener("keydown", onInteraction, { passive: true });
    window.addEventListener("touchstart", onInteraction, { passive: true });

    void pulse();

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("auth-changed", onAuthChanged);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      window.removeEventListener("touchstart", onInteraction);
    };
  }, []);

  return null;
}

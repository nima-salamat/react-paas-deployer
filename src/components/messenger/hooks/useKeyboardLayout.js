import { useEffect, useState } from "react";

/**
 * Mobile virtual keyboard: pin the shell to the visual viewport so the chat
 * header stays visible at the top and the composer stays above the keyboard.
 */
export default function useKeyboardLayout(isMobileDevice) {
  const [kbLayout, setKbLayout] = useState({
    top: 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (!isMobileDevice) {
      setKbLayout({ top: 0, height: window.innerHeight });
      return undefined;
    }
    const vv = window.visualViewport;
    const update = () => {
      if (!vv) {
        setKbLayout({ top: 0, height: window.innerHeight });
        return;
      }
      setKbLayout({
        top: Math.max(0, vv.offsetTop || 0),
        height: Math.max(0, vv.height || window.innerHeight),
      });
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isMobileDevice]);

  return kbLayout;
}

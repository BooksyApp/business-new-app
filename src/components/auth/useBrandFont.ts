import { useEffect } from "react";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";

/** The brand face (as on booqi-web). Falls back to Inter if it cannot load. */
export const BRAND_FONT = '"Plus Jakarta Sans", Inter, system-ui, sans-serif';

export function useBrandFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

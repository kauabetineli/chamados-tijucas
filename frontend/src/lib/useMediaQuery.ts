import { useSyncExternalStore } from "react";

/** true enquanto a media query casar (ex.: "(min-width: 768px)"). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", avisar);
      return () => m.removeEventListener("change", avisar);
    },
    () => window.matchMedia(query).matches,
  );
}

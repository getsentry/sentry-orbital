import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { WebHaptics } from "web-haptics";

const HapticsContext = createContext<WebHaptics | null>(null);

export function HapticsProvider({ children }: { children: ReactNode }) {
  const hapticsRef = useRef<WebHaptics | null>(null);

  if (!hapticsRef.current) {
    hapticsRef.current = new WebHaptics();
  }

  useEffect(() => {
    return () => {
      hapticsRef.current?.destroy();
      hapticsRef.current = null;
    };
  }, []);

  return (
    <HapticsContext value={hapticsRef.current}>
      {children}
    </HapticsContext>
  );
}

export function useHaptics(): WebHaptics | null {
  return useContext(HapticsContext);
}

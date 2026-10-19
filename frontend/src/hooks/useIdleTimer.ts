import { useEffect, useRef } from "react";

// "ecsa:activity" es un evento propio: los componentes que mantienen al
// usuario "presente" sin que toque la página (ej. un video de YouTube en un
// iframe, cuyos clics y movimientos no llegan a esta ventana) lo disparan.
export const ACTIVITY_EVENT = "ecsa:activity";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click", ACTIVITY_EVENT];

interface IdleWarning {
  // Cuánto antes del cierre se avisa (ms).
  warnBeforeMs: number;
  onWarn: () => void;
  // El usuario volvió a estar activo después del aviso.
  onActive: () => void;
}

export function useIdleTimer(timeoutMs: number, onIdle: () => void, warning?: IdleWarning) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;
  const warningRef = useRef(warning);
  warningRef.current = warning;
  const warnBeforeMs = warning?.warnBeforeMs;

  useEffect(() => {
    let idleTimer: number | undefined;
    let warnTimer: number | undefined;
    let warned = false;

    function resetTimer() {
      window.clearTimeout(idleTimer);
      window.clearTimeout(warnTimer);
      if (warned) {
        warned = false;
        warningRef.current?.onActive();
      }
      if (warnBeforeMs && warnBeforeMs < timeoutMs) {
        warnTimer = window.setTimeout(() => {
          warned = true;
          warningRef.current?.onWarn();
        }, timeoutMs - warnBeforeMs);
      }
      idleTimer = window.setTimeout(() => {
        warned = false;
        onIdleRef.current();
      }, timeoutMs);
    }

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(warnTimer);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [timeoutMs, warnBeforeMs]);
}

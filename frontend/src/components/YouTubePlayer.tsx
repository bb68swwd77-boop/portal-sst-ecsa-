import { useEffect, useRef } from "react";

// Extrae el ID de video de las formas comunes de URL de YouTube (incluye
// videos "no listados", que usan la misma estructura de URL que públicos):
// https://youtu.be/ID, https://www.youtube.com/watch?v=ID,
// https://www.youtube.com/embed/ID, o un ID "pelado" de 11 caracteres.
export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const embedMatch = u.pathname.match(/\/(embed|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) return embedMatch[2];
    }
  } catch {
    return null;
  }
  return null;
}

// Carga el script de la YouTube IFrame API una sola vez para toda la app,
// sin importar cuántos reproductores se monten a lo largo de la sesión.
let apiLoadPromise: Promise<void> | null = null;
function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const previousCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiLoadPromise;
}

const PROGRESS_INTERVAL_MS = 10000;

interface YouTubePlayerProps {
  videoId: string;
  onProgress: (percentWatched: number) => void;
}

export function YouTubePlayer({ videoId, onProgress }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    let cancelled = false;

    function clearProgressInterval() {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function reportCurrentProgress() {
      const player = playerRef.current;
      if (!player?.getDuration) return;
      const duration = player.getDuration();
      const current = player.getCurrentTime();
      if (!duration) return;
      onProgressRef.current(Math.round((current / duration) * 100));
    }

    loadYouTubeIframeApi().then(() => {
      if (cancelled || !containerRef.current) return;
      const YT = (window as any).YT;
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0 },
        events: {
          onStateChange: (event: any) => {
            if (event.data === YT.PlayerState.PLAYING) {
              clearProgressInterval();
              intervalRef.current = window.setInterval(reportCurrentProgress, PROGRESS_INTERVAL_MS);
            } else if (event.data === YT.PlayerState.PAUSED) {
              clearProgressInterval();
            } else if (event.data === YT.PlayerState.ENDED) {
              clearProgressInterval();
              onProgressRef.current(100);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      clearProgressInterval();
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // Nuevo reproductor si cambia el video (ej. al cambiar de lección).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 8, overflow: "hidden" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}

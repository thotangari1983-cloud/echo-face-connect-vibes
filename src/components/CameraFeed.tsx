import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Aperture } from "lucide-react";

type Props = {
  onFrame?: (canvas: HTMLCanvasElement) => void;
  onMouthOpen?: (open: number) => void;
  running?: boolean;
};

export function CameraFeed({ onFrame, onMouthOpen, running = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setActive(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camera error");
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  useEffect(() => () => stop(), []);

  // Simulated lip landmarks + mouth-open metric (placeholder for MediaPipe).
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      const c = overlayRef.current;
      if (v && c && v.videoWidth) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, c.width, c.height);

        // Face bounding box (centered, animated)
        const w = c.width * 0.42;
        const h = c.height * 0.6;
        const x = (c.width - w) / 2;
        const y = (c.height - h) / 2 - 10;
        ctx.strokeStyle = "rgba(120,200,255,0.7)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // Corner brackets
        ctx.strokeStyle = "rgba(190,140,255,0.95)";
        ctx.lineWidth = 3;
        const L = 18;
        [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy], i) => {
          ctx.beginPath();
          const sx = i % 2 === 0 ? 1 : -1;
          const sy = i < 2 ? 1 : -1;
          ctx.moveTo(cx, cy + sy * L);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + sx * L, cy);
          ctx.stroke();
        });

        // Only simulate lip movement when the assistant is actively
        // listening — prevents the camera from auto-driving lip recognition.
        const t = performance.now() / 600;
        const open = running ? (Math.sin(t) + 1) / 2 : 0;
        if (running) onMouthOpen?.(open);
        const mx = c.width / 2;
        const my = y + h * 0.78;
        const mw = w * 0.32;
        const mh = 6 + open * 18;
        ctx.strokeStyle = "rgba(120,255,220,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(mx, my, mw, mh, 0, 0, Math.PI * 2);
        ctx.stroke();
        // landmark dots
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const px = mx + Math.cos(a) * mw;
          const py = my + Math.sin(a) * mh;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active, onMouthOpen, running]);

  const snapshot = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    onFrame?.(c);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `echoface-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="glass-strong scanline relative overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${active ? "online" : "offline"}`} />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Camera Feed
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={snapshot} disabled={!active} className="btn-ghost disabled:opacity-40">
            <Aperture className="h-3.5 w-3.5" /> Snap
          </button>
          {active ? (
            <button onClick={stop} className="btn-ghost">
              <CameraOff className="h-3.5 w-3.5" /> Stop
            </button>
          ) : (
            <button onClick={start} className="btn-neon text-xs">
              <Camera className="h-3.5 w-3.5" /> Start
            </button>
          )}
        </div>
      </div>
      <div className="relative aspect-video bg-black/60">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        <canvas ref={overlayRef} className="absolute inset-0 h-full w-full" />
        {!active && (
          <div className="absolute inset-0 grid-bg flex items-center justify-center">
            <div className="text-center">
              <div className="font-display text-sm uppercase tracking-[0.4em] text-muted-foreground">
                Camera Offline
              </div>
              {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

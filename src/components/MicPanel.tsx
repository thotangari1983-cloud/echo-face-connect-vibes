import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type Props = { onTranscript?: (text: string) => void };

// Minimal types for the Web Speech API.
type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
};

export function MicPanel({ onTranscript }: Props) {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bars, setBars] = useState<number[]>(Array(28).fill(0.1));
  const audioRef = useRef<{ ctx: AudioContext; stream: MediaStream; analyser: AnalyserNode; raf: number } | null>(null);
  const recRef = useRef<SR | null>(null);
  const wantRef = useRef(false);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const next = Array.from({ length: 28 }, (_, i) => {
          const v = data[Math.floor((i / 28) * data.length)] / 255;
          return Math.max(0.08, v);
        });
        setBars(next);
        audioRef.current!.raf = requestAnimationFrame(tick);
      };
      audioRef.current = { ctx, stream, analyser, raf: 0 };
      tick();

      const w = window as unknown as {
        SpeechRecognition?: new () => SR;
        webkitSpeechRecognition?: new () => SR;
      };
      const SRCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (SRCtor) {
        const rec = new SRCtor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";
        rec.onresult = (e) => {
          let t = "";
          for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
          setText(t);
          onTranscript?.(t);
        };
        rec.onerror = () => {};
        rec.onend = () => {
          // Auto-restart while the user still wants to listen, so the mic
          // indicator doesn't flicker on/off when the recognizer pauses.
          if (wantRef.current) {
            try { rec.start(); } catch { /* already started */ }
          } else {
            setListening(false);
          }
        };
        rec.start();
        recRef.current = rec;
      }
      wantRef.current = true;
      setListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mic error");
    }
  };

  const stop = () => {
    wantRef.current = false;
    const a = audioRef.current;
    if (a) {
      cancelAnimationFrame(a.raf);
      a.stream.getTracks().forEach((t) => t.stop());
      a.ctx.close();
    }
    audioRef.current = null;
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  };

  useEffect(() => () => stop(), []);

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${listening ? "online" : "offline"}`} />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Microphone
          </span>
        </div>
        {listening ? (
          <button onClick={stop} className="btn-ghost">
            <MicOff className="h-3.5 w-3.5" /> Stop
          </button>
        ) : (
          <button onClick={start} className="btn-neon text-xs">
            <Mic className="h-3.5 w-3.5" /> Listen
          </button>
        )}
      </div>
      <div className="h-20 flex items-end justify-center gap-1 px-2">
        {bars.map((b, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-gradient-to-t from-primary to-accent"
            style={{ height: `${b * 100}%`, transition: "height 90ms linear" }}
          />
        ))}
      </div>
      <div className="mt-3 min-h-10 text-sm text-muted-foreground">
        {text ? <span className="text-foreground">“{text}”</span> : "Awaiting speech…"}
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

// EchoFace Python backend client (FastAPI: /stt /tts /chat /lip /pipeline /ws)
// Configurable URLs persisted in localStorage. Also exposes window.EchoFace
// so the same API works from DevTools, exactly like the bundled echoface-sync.js.
import { useEffect, useState } from "react";

const BACKEND_KEY = "echoface.backend.http";
const WS_KEY = "echoface.backend.ws";
const DEFAULTS = { http: "http://localhost:8000", ws: "ws://localhost:8000/ws" };

function lsGet(k: string, fallback: string) {
  if (typeof localStorage === "undefined") return fallback;
  try { return localStorage.getItem(k) || fallback; } catch { return fallback; }
}
function lsSet(k: string, v: string) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
}

export type BackendUrls = { http: string; ws: string };
export function getBackendUrls(): BackendUrls {
  return { http: lsGet(BACKEND_KEY, DEFAULTS.http), ws: lsGet(WS_KEY, DEFAULTS.ws) };
}
export function setBackendUrls(next: Partial<BackendUrls>) {
  if (next.http) lsSet(BACKEND_KEY, next.http);
  if (next.ws) lsSet(WS_KEY, next.ws);
  urlListeners.forEach((l) => l(getBackendUrls()));
  // reconnect WS to the new URL
  ws.disconnect();
  ws.connect();
}
const urlListeners = new Set<(u: BackendUrls) => void>();
export function useBackendUrls() {
  const [u, setU] = useState<BackendUrls>(getBackendUrls());
  useEffect(() => {
    setU(getBackendUrls());
    const l = (n: BackendUrls) => setU(n);
    urlListeners.add(l);
    return () => { urlListeners.delete(l); };
  }, []);
  return u;
}

// ---- REST helpers ----
async function postJSON<T = unknown>(path: string, body: unknown): Promise<T> {
  const r = await fetch(getBackendUrls().http + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
}
async function postFile<T = unknown>(path: string, file: File | Blob, name = "file"): Promise<T> {
  const fd = new FormData();
  const f = file instanceof File ? file : new File([file], "blob", { type: file.type });
  fd.append(name, f);
  const r = await fetch(getBackendUrls().http + path, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
}

export type LipResult = {
  status: string;
  mouth_open: boolean;
  ratio: number;
  label?: string;
};

export const echofaceApi = {
  health: async () => {
    const r = await fetch(getBackendUrls().http + "/health");
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<{ status: string }>;
  },
  stt: async (audio: Blob): Promise<string> => {
    const f = new File([audio], "audio.wav", { type: audio.type || "audio/wav" });
    const res = await postFile<{ transcript: string }>("/stt", f);
    return res.transcript || "";
  },
  chat: async (message: string, history: unknown[] = []): Promise<string> => {
    const res = await postJSON<{ reply: string }>("/chat", { message, history });
    return res.reply || "";
  },
  lip: async (frame: Blob): Promise<LipResult> => {
    const f = new File([frame], "frame.jpg", { type: frame.type || "image/jpeg" });
    return postFile<LipResult>("/lip", f);
  },
  tts: async (text: string): Promise<HTMLAudioElement> => {
    const r = await fetch(getBackendUrls().http + "/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) throw new Error(`/tts ${r.status}`);
    const blob = await r.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    void audio.play().catch(() => {});
    return audio;
  },
  pipeline: async (audio: Blob) => {
    const f = new File([audio], "audio.wav", { type: audio.type || "audio/wav" });
    const res = await postFile<{ transcript: string; reply: string; audio_b64?: string }>(
      "/pipeline", f,
    );
    let player: HTMLAudioElement | null = null;
    if (res.audio_b64) {
      const bytes = Uint8Array.from(atob(res.audio_b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/wav" });
      player = new Audio(URL.createObjectURL(blob));
      void player.play().catch(() => {});
    }
    return { transcript: res.transcript, reply: res.reply, audio: player };
  },
};

// ---- WebSocket bridge ----
type WSStatus = "idle" | "connecting" | "open" | "closed" | "error";
type AnyMsg = { type: string; [k: string]: unknown };
type Handler = (m: AnyMsg) => void;

class EchoWS {
  private sock: WebSocket | null = null;
  private should = false;
  private attempts = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private statusListeners = new Set<(s: WSStatus) => void>();
  status: WSStatus = "idle";

  on(type: string, fn: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }
  onStatus(fn: (s: WSStatus) => void) {
    this.statusListeners.add(fn); fn(this.status);
    return () => { this.statusListeners.delete(fn); };
  }
  private setStatus(s: WSStatus) {
    this.status = s; this.statusListeners.forEach((l) => l(s));
  }
  connect() {
    if (typeof window === "undefined") return;
    this.should = true;
    this.open();
  }
  disconnect() {
    this.should = false;
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
    try { this.sock?.close(1000, "client"); } catch { /* ignore */ }
    this.sock = null;
    this.setStatus("closed");
  }
  send(payload: unknown) {
    const data = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (this.sock && this.sock.readyState === WebSocket.OPEN) this.sock.send(data);
  }
  private open() {
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
    this.setStatus("connecting");
    let s: WebSocket;
    try { s = new WebSocket(getBackendUrls().ws); }
    catch { this.setStatus("error"); return this.schedule(); }
    this.sock = s;
    s.onopen = () => {
      this.attempts = 0;
      this.setStatus("open");
      this.send({ type: "register", role: "browser" });
    };
    s.onmessage = (e) => {
      try {
        const msg = JSON.parse(typeof e.data === "string" ? e.data : "") as AnyMsg;
        this.handlers.get(msg.type)?.forEach((h) => h(msg));
        this.handlers.get("*")?.forEach((h) => h(msg));
      } catch { /* ignore */ }
    };
    s.onerror = () => this.setStatus("error");
    s.onclose = () => {
      this.sock = null;
      this.setStatus("closed");
      if (this.should) this.schedule();
    };
  }
  private schedule() {
    this.attempts += 1;
    const delay = Math.min(15000, 500 * 2 ** Math.min(this.attempts - 1, 5))
      + Math.floor(Math.random() * 300);
    this.retry = setTimeout(() => this.open(), delay);
  }
}

export const ws = new EchoWS();

export function useEchofaceWS() {
  const [status, setStatus] = useState<WSStatus>(ws.status);
  useEffect(() => ws.onStatus(setStatus), []);
  return { status, send: (p: unknown) => ws.send(p) };
}

// Auto-start WS + window bindings (browser only)
if (typeof window !== "undefined") {
  ws.connect();
  // window.EchoFace API mirroring echoface-sync.js
  type EchoFaceGlobal = {
    setBackend: (http: string, wsUrl?: string) => void;
    test: () => Promise<void>;
    chat: (m: string, h?: unknown[]) => Promise<string>;
    tts: (t: string) => Promise<HTMLAudioElement>;
    stt: (b: Blob) => Promise<string>;
    pipeline: (b: Blob) => Promise<{ transcript: string; reply: string; audio: HTMLAudioElement | null }>;
    lip: (b: Blob) => Promise<LipResult>;
    sendWS: (p: unknown) => void;
    onWS: (type: string, fn: Handler) => () => void;
    wsStatus: WSStatus;
  };
  const g = window as unknown as { EchoFace?: EchoFaceGlobal };
  g.EchoFace = {
    setBackend: (http, wsUrl) => setBackendUrls({ http, ws: wsUrl || http.replace(/^http/, "ws") + "/ws" }),
    test: async () => {
      try { console.log("✅ Health:", await echofaceApi.health()); }
      catch (e) { console.error("❌ Backend unreachable:", (e as Error).message); }
    },
    chat: echofaceApi.chat,
    tts: echofaceApi.tts,
    stt: echofaceApi.stt,
    pipeline: echofaceApi.pipeline,
    lip: echofaceApi.lip,
    sendWS: (p) => ws.send(p),
    onWS: (t, fn) => ws.on(t, fn),
    get wsStatus() { return ws.status; },
  };
  // eslint-disable-next-line no-console
  console.log("🚀 EchoFace ready. Try: EchoFace.test()", getBackendUrls());
}

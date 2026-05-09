// Robust real-time WebSocket client for ESP32-S3.
// Features: auto-reconnect with exponential backoff, heartbeat/ping,
// JSON message parsing, typed pub/sub, send queue while offline,
// page-visibility awareness, and React hook bindings.
import { useEffect, useRef, useState } from "react";
import { setDevice } from "./device-store";

export type ESPMessage =
  | { type: "status"; connected: boolean; ssid?: string; ip?: string; rssi?: number }
  | { type: "lip"; text: string; confidence?: number }
  | { type: "mic"; text: string }
  | { type: "tts"; text: string }
  | { type: "pong"; t: number }
  | { type: string; [k: string]: unknown };

type Listener = (msg: ESPMessage, raw: string) => void;
type StateListener = (s: SocketState) => void;

export type SocketState = {
  status: "idle" | "connecting" | "open" | "closed" | "error";
  url: string | null;
  attempts: number;
  lastError: string | null;
  lastMessageAt: number | null;
};

const DEFAULT_URL =
  (typeof localStorage !== "undefined" && localStorage.getItem("echoface.esp32.ws")) ||
  "ws://192.168.1.42:81";

class ESP32Socket {
  private ws: WebSocket | null = null;
  private url: string = DEFAULT_URL;
  private shouldRun = false;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private deadTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: string[] = [];
  private listeners = new Set<Listener>();
  private stateListeners = new Set<StateListener>();
  private state: SocketState = {
    status: "idle",
    url: null,
    attempts: 0,
    lastError: null,
    lastMessageAt: null,
  };

  getState() {
    return this.state;
  }

  private setState(patch: Partial<SocketState>) {
    this.state = { ...this.state, ...patch };
    this.stateListeners.forEach((l) => l(this.state));
  }

  onMessage(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  onState(l: StateListener) {
    this.stateListeners.add(l);
    l(this.state);
    return () => this.stateListeners.delete(l);
  }

  connect(url?: string) {
    if (typeof window === "undefined") return;
    if (url) {
      this.url = url;
      try {
        localStorage.setItem("echoface.esp32.ws", url);
      } catch {
        /* ignore */
      }
    }
    this.shouldRun = true;
    this.open();
  }

  disconnect() {
    this.shouldRun = false;
    this.clearTimers();
    if (this.ws) {
      try {
        this.ws.close(1000, "client-disconnect");
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.setState({ status: "closed" });
  }

  send(payload: unknown) {
    const data = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      // queue (cap to avoid unbounded memory)
      if (this.queue.length < 100) this.queue.push(data);
    }
  }

  private open() {
    this.clearTimers();
    this.setState({ status: "connecting", url: this.url, lastError: null });
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      this.setState({ status: "error", lastError: (e as Error).message });
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.setState({ status: "open", attempts: 0, lastError: null });
      // Flush queue
      while (this.queue.length && ws.readyState === WebSocket.OPEN) {
        ws.send(this.queue.shift()!);
      }
      // Hello + start heartbeat
      this.send({ type: "hello", client: "echoface-web", t: Date.now() });
      this.startHeartbeat();
    };

    ws.onmessage = (event) => {
      const raw = typeof event.data === "string" ? event.data : "";
      this.setState({ lastMessageAt: Date.now() });
      this.armDeadTimer();
      let msg: ESPMessage;
      try {
        msg = raw ? (JSON.parse(raw) as ESPMessage) : ({ type: "raw" } as ESPMessage);
      } catch {
        msg = { type: "text", text: raw } as unknown as ESPMessage;
      }
      // Mirror status into device store
      if (msg.type === "status") {
        setDevice({
          connected: !!msg.connected,
          ssid: (msg.ssid as string | undefined) ?? null,
          ip: (msg.ip as string | undefined) ?? null,
          rssi: typeof msg.rssi === "number" ? msg.rssi : null,
        });
      }
      this.listeners.forEach((l) => l(msg, raw));
    };

    ws.onerror = () => {
      this.setState({ status: "error", lastError: "WebSocket error" });
    };

    ws.onclose = (ev) => {
      this.stopHeartbeat();
      this.ws = null;
      this.setState({ status: "closed", lastError: ev.reason || null });
      if (this.shouldRun) this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    this.attempts += 1;
    this.setState({ attempts: this.attempts });
    // Exponential backoff: 0.5s, 1s, 2s, 4s, ... capped at 15s + jitter
    const base = Math.min(15000, 500 * 2 ** Math.min(this.attempts - 1, 5));
    const delay = base + Math.floor(Math.random() * 400);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "ping", t: Date.now() });
    }, 10000);
    this.armDeadTimer();
  }

  private armDeadTimer() {
    if (this.deadTimer) clearTimeout(this.deadTimer);
    // If we don't hear back for 25s, force reconnect.
    this.deadTimer = setTimeout(() => {
      if (this.ws) {
        try {
          this.ws.close(4000, "dead-connection");
        } catch {
          /* ignore */
        }
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    if (this.deadTimer) clearTimeout(this.deadTimer);
    this.deadTimer = null;
  }

  private clearTimers() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopHeartbeat();
  }
}

export const esp32 = new ESP32Socket();

// Reconnect quickly when the tab becomes visible again.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const s = esp32.getState();
      if (s.status === "closed" || s.status === "error") {
        esp32.connect();
      }
    }
  });
}

// React hook
export function useESP32Socket(url?: string) {
  const [state, setState] = useState<SocketState>(esp32.getState());
  const [lastMessage, setLastMessage] = useState<ESPMessage | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const offS = esp32.onState(setState);
    const offM = esp32.onMessage((m) => setLastMessage(m));
    if (!startedRef.current) {
      startedRef.current = true;
      esp32.connect(url);
    }
    return () => {
      offS();
      offM();
    };
  }, [url]);

  return {
    state,
    lastMessage,
    send: (p: unknown) => esp32.send(p),
    connect: (u?: string) => esp32.connect(u),
    disconnect: () => esp32.disconnect(),
  };
}

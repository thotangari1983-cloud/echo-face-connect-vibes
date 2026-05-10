/**
 * esp32-socket.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Production-grade real-time WebSocket client for ESP32-S3
 * Features:
 *   • Auto-reconnect with exponential backoff + jitter
 *   • Heartbeat ping/pong (dead-connection detection)
 *   • Offline send queue (messages sent after reconnect)
 *   • JSON message parsing with typed events
 *   • Tab-visibility wake-up
 *   • Backend bridge (routes messages to FastAPI /ws)
 *   • React hook: useESP32Socket
 * ───────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { setDevice } from "./device-store";

// ── Types ────────────────────────────────────────────────────────────────────

export type ESP32State =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface DeviceStatus {
  connected: boolean;
  ssid?: string;
  ip?: string;
  rssi?: number;
  uptime?: number;
  freeHeap?: number;
}

export type ESP32MessageType =
  | "pong"
  | "status"
  | "oled"
  | "led"
  | "speak"
  | "text"
  | "sensor"
  | "error"
  | "ack"
  | string;

export interface ESP32Message {
  type: ESP32MessageType;
  [key: string]: unknown;
}

export type ESP32Command =
  | { type: "ping" }
  | { type: "LED_ON" }
  | { type: "LED_OFF" }
  | { type: "SPEAK"; freq?: number; duration?: number }
  | { type: "TEXT"; text: string }
  | { type: "OLED_CLEAR" }
  | { type: "OLED_BRIGHT"; level: number }
  | { type: "STATUS" }
  | { type: string; [key: string]: unknown };

type MessageHandler = (msg: ESP32Message) => void;
type StateHandler = (state: ESP32State) => void;

// ── Config ───────────────────────────────────────────────────────────────────

const DEFAULTS = {
  pingIntervalMs: 5_000,
  pongTimeoutMs: 4_000,
  maxRetries: Infinity as number,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  queueLimit: 50,
} as const;

// ── ESP32Socket class ────────────────────────────────────────────────────────

export class ESP32Socket {
  private url = "";
  private ws: WebSocket | null = null;
  private state: ESP32State = "idle";

  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private retryCount = 0;
  private queue: string[] = [];

  private msgHandlers = new Set<MessageHandler>();
  private stateHandlers = new Set<StateHandler>();
  private typeHandlers = new Map<string, Set<MessageHandler>>();

  public deviceStatus: DeviceStatus = { connected: false };

  private backendWS: WebSocket | null = null;
  private backendUrl = "";

  connect(url: string): this {
    this.url = url;
    this.retryCount = 0;
    this._connect();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._onVisibilityChange);
    }
    return this;
  }

  disconnect(): void {
    this._clearTimers();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
    }
    try {
      this.ws?.close(1000, "Manual disconnect");
    } catch {
      /* ignore */
    }
    this.ws = null;
    this._setState("disconnected");
  }

  send(cmd: ESP32Command): boolean {
    const payload = this._serialize(cmd);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      return true;
    }
    this._enqueue(payload);
    return false;
  }

  sendRaw(text: string): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(text);
      return true;
    }
    this._enqueue(text);
    return false;
  }

  getState(): ESP32State {
    return this.state;
  }
  isConnected(): boolean {
    return this.state === "connected";
  }

  onMessage(fn: MessageHandler): () => void {
    this.msgHandlers.add(fn);
    return () => {
      this.msgHandlers.delete(fn);
    };
  }

  on(type: ESP32MessageType, fn: MessageHandler): () => void {
    if (!this.typeHandlers.has(type)) this.typeHandlers.set(type, new Set());
    this.typeHandlers.get(type)!.add(fn);
    return () => {
      this.typeHandlers.get(type)?.delete(fn);
    };
  }

  onState(fn: StateHandler): () => void {
    this.stateHandlers.add(fn);
    fn(this.state);
    return () => {
      this.stateHandlers.delete(fn);
    };
  }

  bridgeBackend(backendWsUrl: string): this {
    this.backendUrl = backendWsUrl;
    this._connectBackend();
    return this;
  }

  sendToBackend(payload: object): boolean {
    if (this.backendWS?.readyState === WebSocket.OPEN) {
      this.backendWS.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  ledOn() {
    return this.send({ type: "LED_ON" });
  }
  ledOff() {
    return this.send({ type: "LED_OFF" });
  }
  oledText(text: string) {
    return this.send({ type: "TEXT", text });
  }
  oledClear() {
    return this.send({ type: "OLED_CLEAR" });
  }
  speak(freq = 880, duration = 200) {
    return this.send({ type: "SPEAK", freq, duration });
  }
  requestStatus() {
    return this.send({ type: "STATUS" });
  }

  private _connect(): void {
    if (!this.url) return;
    this._setState(this.retryCount === 0 ? "connecting" : "reconnecting");

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      console.error("[ESP32] Bad URL:", e);
      this._scheduleRetry();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      console.log(`[ESP32] ✅ Connected (attempt ${this.retryCount + 1})`);
      this.retryCount = 0;
      this._setState("connected");
      this._flushQueue();
      this._startHeartbeat();
      this.requestStatus();
    };

    ws.onmessage = (event) => {
      this._handleMessage(event.data);
    };

    ws.onclose = (event) => {
      console.warn(`[ESP32] ⚠️ Closed (code ${event.code})`);
      this._clearTimers();
      this.deviceStatus.connected = false;
      if (event.code !== 1000) {
        this._scheduleRetry();
      } else {
        this._setState("disconnected");
      }
    };

    ws.onerror = () => {
      console.error("[ESP32] ❌ WebSocket error");
    };
  }

  private _connectBackend(): void {
    if (!this.backendUrl) return;
    let s: WebSocket;
    try {
      s = new WebSocket(this.backendUrl);
    } catch {
      setTimeout(() => this._connectBackend(), 5_000);
      return;
    }
    this.backendWS = s;

    s.onopen = () => {
      console.log("[Backend] ✅ Bridge connected");
      s.send(JSON.stringify({ type: "register", role: "esp32_bridge" }));
    };

    s.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as ESP32Message;
        if (data.type === "esp32_cmd" && data.cmd) {
          this.sendRaw(String(data.cmd));
        }
        if (data.type === "chat_reply" && typeof data.reply === "string") {
          this.oledText((data.reply as string).slice(0, 64));
        }
      } catch {
        /* ignore */
      }
    };

    s.onclose = () => {
      console.warn("[Backend] Bridge closed — retrying in 5s");
      setTimeout(() => this._connectBackend(), 5_000);
    };

    s.onerror = () => {
      /* close handler will retry */
    };
  }

  private _handleMessage(raw: string | ArrayBuffer): void {
    let msg: ESP32Message;

    if (typeof raw !== "string") {
      this._emit({ type: "binary", data: raw } as ESP32Message);
      return;
    }

    if (raw === "pong") {
      this._clearPongTimer();
      this._emit({ type: "pong" });
      return;
    }

    try {
      msg = JSON.parse(raw) as ESP32Message;
    } catch {
      msg = { type: "text", text: raw };
    }

    if (msg.type === "status") {
      this.deviceStatus = {
        connected: true,
        ssid: msg.ssid as string | undefined,
        ip: msg.ip as string | undefined,
        rssi: msg.rssi as number | undefined,
        uptime: msg.uptime as number | undefined,
        freeHeap: msg.freeHeap as number | undefined,
      };
      // Mirror into Lovable device store
      try {
        setDevice({
          connected: true,
          ssid: this.deviceStatus.ssid ?? null,
          ip: this.deviceStatus.ip ?? null,
          rssi: this.deviceStatus.rssi ?? null,
        });
      } catch {
        /* ignore */
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("esp32:status", { detail: this.deviceStatus }),
        );
      }
    }

    if (this.backendWS?.readyState === WebSocket.OPEN) {
      this.backendWS.send(JSON.stringify({ type: "esp32_data", payload: msg }));
    }

    this._emit(msg);
  }

  private _emit(msg: ESP32Message): void {
    this.msgHandlers.forEach((fn) => fn(msg));
    this.typeHandlers.get(msg.type)?.forEach((fn) => fn(msg));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(`esp32:${msg.type}`, { detail: msg }));
    }
  }

  private _setState(state: ESP32State): void {
    this.state = state;
    this.stateHandlers.forEach((fn) => fn(state));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("esp32:state", { detail: state }));
    }
  }

  private _startHeartbeat(): void {
    this._clearTimers();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      this.ws.send("ping");
      this.pongTimer = setTimeout(() => {
        console.warn("[ESP32] 💀 No pong — dead connection, reconnecting");
        try {
          this.ws?.close();
        } catch {
          /* ignore */
        }
      }, DEFAULTS.pongTimeoutMs);
    }, DEFAULTS.pingIntervalMs);
  }

  private _clearPongTimer(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private _clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private _scheduleRetry(): void {
    if (
      DEFAULTS.maxRetries !== Infinity &&
      this.retryCount >= DEFAULTS.maxRetries
    ) {
      console.error("[ESP32] Max retries reached. Giving up.");
      this._setState("disconnected");
      return;
    }
    const exp = Math.min(
      DEFAULTS.baseDelayMs * 2 ** this.retryCount,
      DEFAULTS.maxDelayMs,
    );
    const jitter = Math.random() * 0.3 * exp;
    const delay = Math.round(exp + jitter);

    console.log(`[ESP32] Retry #${this.retryCount + 1} in ${delay}ms`);
    this._setState("reconnecting");
    this.retryTimer = setTimeout(() => {
      this.retryCount++;
      this._connect();
    }, delay);
  }

  private _enqueue(payload: string): void {
    if (this.queue.length >= DEFAULTS.queueLimit) this.queue.shift();
    this.queue.push(payload);
  }

  private _flushQueue(): void {
    while (this.queue.length && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(this.queue.shift()!);
    }
  }

  private _serialize(cmd: ESP32Command): string {
    if (
      cmd.type === "LED_ON" ||
      cmd.type === "LED_OFF" ||
      cmd.type === "OLED_CLEAR" ||
      cmd.type === "ping" ||
      cmd.type === "STATUS"
    ) {
      return cmd.type;
    }
    if (cmd.type === "TEXT") return `TEXT:${(cmd as { text: string }).text}`;
    if (cmd.type === "SPEAK") {
      const c = cmd as { freq?: number; duration?: number };
      return `SPEAK:${c.freq ?? 880}:${c.duration ?? 200}`;
    }
    if (cmd.type === "OLED_BRIGHT") {
      const c = cmd as { level: number };
      return `OLED_BRIGHT:${c.level}`;
    }
    return JSON.stringify(cmd);
  }

  private _onVisibilityChange = (): void => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      this.state !== "connected"
    ) {
      console.log("[ESP32] Tab visible — reconnecting");
      this._clearTimers();
      this.retryCount = 0;
      this._connect();
    }
  };
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const esp32 = new ESP32Socket();

// ── React Hook ────────────────────────────────────────────────────────────────

interface UseESP32SocketOptions {
  backendWsUrl?: string;
  autoConnect?: boolean;
}

interface UseESP32SocketReturn {
  state: ESP32State;
  isConnected: boolean;
  lastMessage: ESP32Message | null;
  deviceStatus: DeviceStatus;
  send: (cmd: ESP32Command) => boolean;
  sendRaw: (text: string) => boolean;
  reconnect: () => void;
  ledOn: () => boolean;
  ledOff: () => boolean;
  oledText: (text: string) => boolean;
  speak: (freq?: number, duration?: number) => boolean;
}

export function useESP32Socket(
  esp32Url: string,
  options: UseESP32SocketOptions = {},
): UseESP32SocketReturn {
  const { backendWsUrl, autoConnect = true } = options;

  const [state, setState] = useState<ESP32State>(esp32.getState());
  const [lastMessage, setLastMessage] = useState<ESP32Message | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(
    esp32.deviceStatus,
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect && esp32Url) {
      esp32.connect(esp32Url);
      if (backendWsUrl) esp32.bridgeBackend(backendWsUrl);
    }

    const unsubState = esp32.onState((s) => {
      if (mountedRef.current) setState(s);
    });

    const unsubMsg = esp32.onMessage((msg) => {
      if (!mountedRef.current) return;
      setLastMessage(msg);
      if (msg.type === "status") setDeviceStatus({ ...esp32.deviceStatus });
    });

    return () => {
      mountedRef.current = false;
      unsubState();
      unsubMsg();
    };
  }, [esp32Url, backendWsUrl, autoConnect]);

  const reconnect = useCallback(() => {
    esp32.disconnect();
    setTimeout(() => esp32.connect(esp32Url), 300);
  }, [esp32Url]);

  return {
    state,
    isConnected: state === "connected",
    lastMessage,
    deviceStatus,
    send: (cmd) => esp32.send(cmd),
    sendRaw: (text) => esp32.sendRaw(text),
    reconnect,
    ledOn: () => esp32.ledOn(),
    ledOff: () => esp32.ledOff(),
    oledText: (text) => esp32.oledText(text),
    speak: (f, d) => esp32.speak(f, d),
  };
}

// ── window.EchoFace shim ──────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  type Win = Window & { EchoFace?: Record<string, unknown> };
  const w = window as Win;
  w.EchoFace = {
    ...(w.EchoFace ?? {}),
    esp32Connect: (url: string) => esp32.connect(url),
    esp32Send: (cmd: ESP32Command) => esp32.send(cmd),
    esp32Disconnect: () => esp32.disconnect(),
    esp32Status: () => esp32.deviceStatus,
    esp32On: (type: string, fn: MessageHandler) => esp32.on(type, fn),
  };
}

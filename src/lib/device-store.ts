// Lightweight global pub-sub for ESP32 connection state across pages.
import { useEffect, useState } from "react";

export type DeviceState = {
  connected: boolean;
  ip: string | null;
  ssid: string | null;
  rssi: number | null; // dBm
  lastSeen: number | null;
};

const KEY = "echoface.device";
const initial: DeviceState = { connected: false, ip: null, ssid: null, rssi: null, lastSeen: null };

function read(): DeviceState {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...initial, ...JSON.parse(raw) } : initial;
  } catch {
    return initial;
  }
}

const listeners = new Set<(s: DeviceState) => void>();

export function getDevice() {
  return read();
}

export function setDevice(patch: Partial<DeviceState>) {
  const next = { ...read(), ...patch, lastSeen: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l(next));
}

export function useDevice() {
  const [s, setS] = useState<DeviceState>(initial);
  useEffect(() => {
    setS(read());
    const l = (n: DeviceState) => setS(n);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return s;
}

/** Re-call the ESP32 pairing endpoint with the last known ssid/host. */
export async function retryPairing(): Promise<{ ok: boolean; error?: string }> {
  const cur = read();
  const ssid = cur.ssid;
  const host = cur.ip;
  if (!ssid || !host) {
    return { ok: false, error: "No previous pairing. Open ESP32 Connect first." };
  }
  try {
    await fetch("/api/public/echoface/connect-esp32", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssid, host }),
    }).catch(() => null);
    // Simulated handshake delay + fresh signal sample
    await new Promise((r) => setTimeout(r, 900));
    const rssi = -45 - Math.floor(Math.random() * 30);
    setDevice({ connected: true, ip: host, ssid, rssi });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Pairing failed" };
  }
}

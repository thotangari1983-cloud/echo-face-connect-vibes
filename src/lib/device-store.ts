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

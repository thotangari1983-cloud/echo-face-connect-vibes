import { useState } from "react";
import { useDevice, retryPairing } from "@/lib/device-store";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

export function DeviceStatusCard() {
  const d = useDevice();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bars = d.rssi == null ? 0 : d.rssi > -55 ? 4 : d.rssi > -65 ? 3 : d.rssi > -75 ? 2 : 1;
  const canRetry = !!(d.ssid && d.ip);

  const onRetry = async () => {
    setBusy(true);
    setErr(null);
    const res = await retryPairing();
    if (!res.ok) setErr(res.error ?? "Failed");
    setBusy(false);
  };

  return (
    <div className={`glass p-4 ${d.connected ? "neon-border" : ""}`}>
      <div className="flex items-center gap-4">
        <div
          className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            d.connected
              ? "bg-success/15 text-success animate-pulse-glow"
              : "bg-destructive/15 text-destructive"
          }`}
        >
          {d.connected ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`status-dot ${d.connected ? "online" : "offline"}`} />
            <span
              className={`text-xs uppercase tracking-widest font-semibold ${
                d.connected ? "text-success" : "text-destructive"
              }`}
            >
              {d.connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="font-display text-sm truncate text-foreground">
            {d.connected ? `${d.ssid ?? "WiFi"} · ${d.ip ?? "—"}` : "ESP32-S3 not paired"}
          </div>
        </div>
        <div className="flex items-end gap-0.5 h-7" aria-label={`Signal ${bars}/4`}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-1.5 rounded-sm ${i <= bars ? "bg-primary" : "bg-muted"}`}
              style={{ height: `${i * 25}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {d.lastSeen ? `Last ping ${new Date(d.lastSeen).toLocaleTimeString()}` : "No pings yet"}
        </span>
        <button
          onClick={onRetry}
          disabled={!canRetry || busy}
          title={canRetry ? "Re-pair using last credentials" : "Pair from ESP32 Connect first"}
          className="btn-ghost text-[10px] py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Pairing…" : "Retry Pairing"}
        </button>
      </div>
      {err && <p className="mt-2 text-[11px] text-destructive">{err}</p>}
    </div>
  );
}

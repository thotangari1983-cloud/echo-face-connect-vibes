import { useDevice } from "@/lib/device-store";
import { Wifi, WifiOff } from "lucide-react";

export function DeviceStatusCard() {
  const d = useDevice();
  const bars = d.rssi == null ? 0 : d.rssi > -55 ? 4 : d.rssi > -65 ? 3 : d.rssi > -75 ? 2 : 1;
  return (
    <div className="glass p-4 flex items-center gap-4">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${d.connected ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
        {d.connected ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${d.connected ? "online" : "offline"}`} />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            ESP32-S3
          </span>
        </div>
        <div className="font-display text-sm truncate">
          {d.connected ? `${d.ssid ?? "WiFi"} · ${d.ip ?? "—"}` : "Not paired"}
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
  );
}

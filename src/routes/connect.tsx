import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Wifi, Loader2, CheckCircle2, Cpu } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { setDevice, useDevice } from "@/lib/device-store";

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "Connect ESP32-S3 — Echo Face" },
      { name: "description", content: "Pair your ESP32-S3 module to Echo Face over WiFi." },
    ],
  }),
  component: Connect,
});

function Connect() {
  const device = useDevice();
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [host, setHost] = useState("192.168.1.42");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setDone(false);
    try {
      await fetch("/api/connect-esp32", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid, password, host }),
      }).catch(() => null);
      // Simulated pairing handshake
      await new Promise((r) => setTimeout(r, 1400));
      const rssi = -45 - Math.floor(Math.random() * 30);
      setDevice({ connected: true, ip: host, ssid, rssi });
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    setDevice({ connected: false, ip: null, ssid: null, rssi: null });
    setDone(false);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          Hardware Pairing
        </div>
        <h1 className="font-display text-4xl neon-text">Connect ESP32-S3</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Enter your network credentials and the local IP of the ESP32-S3 module.
          Echo will negotiate a WebSocket channel for realtime control.
        </p>

        <div className="mt-10 grid md:grid-cols-[1.1fr_0.9fr] gap-6">
          <form onSubmit={submit} className="glass-strong p-6 space-y-4">
            <Field label="WiFi SSID">
              <input
                required
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="MyNetwork_5G"
                className="input"
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </Field>
            <Field label="Device Host / IP">
              <input
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.42"
                className="input"
              />
            </Field>
            <div className="pt-2 flex gap-3">
              <button type="submit" disabled={busy} className="btn-neon">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                {busy ? "Pairing…" : "Connect"}
              </button>
              {device.connected && (
                <button type="button" onClick={disconnect} className="btn-ghost">
                  Disconnect
                </button>
              )}
            </div>
            {done && (
              <div className="flex items-center gap-2 text-success text-sm pt-2">
                <CheckCircle2 className="h-4 w-4" /> Handshake complete.
              </div>
            )}
          </form>

          <div className="space-y-4">
            <div className="glass p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Module
                  </div>
                  <div className="font-display">ESP32-S3 · Echo Bridge</div>
                </div>
              </div>
              <Stat label="Status" value={device.connected ? "Online" : "Offline"} ok={device.connected} />
              <Stat label="SSID" value={device.ssid ?? "—"} />
              <Stat label="IP" value={device.ip ?? "—"} />
              <Stat label="RSSI" value={device.rssi != null ? `${device.rssi} dBm` : "—"} />
              <Stat label="Last seen" value={device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : "—"} />
            </div>
            <div className="glass p-6 text-xs text-muted-foreground leading-relaxed">
              <div className="font-display text-sm text-foreground mb-2">Endpoints</div>
              <div className="font-mono space-y-1">
                <div>POST /api/connect-esp32</div>
                <div>POST /api/lipread</div>
                <div>POST /api/ai-response</div>
                <div>POST /api/oled-display</div>
                <div>POST /api/speaker-output</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0 text-sm">
      <span className="text-muted-foreground text-xs uppercase tracking-widest">{label}</span>
      <span className={`font-display ${ok ? "text-success" : ""}`}>{value}</span>
    </div>
  );
}

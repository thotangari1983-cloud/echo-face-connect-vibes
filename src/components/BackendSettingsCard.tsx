import { useState } from "react";
import { Server, Plug, CheckCircle2, XCircle } from "lucide-react";
import {
  echofaceApi,
  setBackendUrls,
  useBackendUrls,
  useEchofaceWS,
} from "@/lib/echoface-backend";

export function BackendSettingsCard() {
  const urls = useBackendUrls();
  const { status } = useEchofaceWS();
  const [http, setHttp] = useState(urls.http);
  const [wsUrl, setWsUrl] = useState(urls.ws);
  const [probe, setProbe] = useState<"idle" | "ok" | "fail">("idle");
  const [busy, setBusy] = useState(false);

  const save = () => {
    setBackendUrls({ http, ws: wsUrl });
  };

  const test = async () => {
    setBusy(true);
    setProbe("idle");
    try {
      await echofaceApi.health();
      setProbe("ok");
    } catch {
      setProbe("fail");
    } finally {
      setBusy(false);
    }
  };

  const dot =
    status === "open"
      ? "bg-success"
      : status === "connecting"
      ? "bg-primary animate-pulse"
      : "bg-destructive";

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Python Backend
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          WS {status}
        </div>
      </div>
      <div className="space-y-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">HTTP</span>
          <input
            value={http}
            onChange={(e) => setHttp(e.target.value)}
            placeholder="http://localhost:8000"
            className="mt-1 w-full bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs font-mono"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">WebSocket</span>
          <input
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            placeholder="ws://localhost:8000/ws"
            className="mt-1 w-full bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs font-mono"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-[11px] flex items-center gap-1.5">
          {probe === "ok" && (
            <span className="text-success flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Online
            </span>
          )}
          {probe === "fail" && (
            <span className="text-destructive flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Unreachable
            </span>
          )}
          {probe === "idle" && (
            <span className="text-muted-foreground">Set your FastAPI server URL</span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={test} disabled={busy} className="btn-ghost text-[10px] py-1.5 px-3">
            <Plug className={`h-3 w-3 ${busy ? "animate-pulse" : ""}`} /> Test
          </button>
          <button onClick={save} className="btn-neon text-[10px] py-1.5 px-3">
            Save & Reconnect
          </button>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Power } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { DeviceStatusCard } from "@/components/DeviceStatusCard";
import { CameraFeed } from "@/components/CameraFeed";
import { MicPanel } from "@/components/MicPanel";
import { LipReadPanel } from "@/components/LipReadPanel";
import { AIResponsePanel } from "@/components/AIResponsePanel";
import { OledSimulator } from "@/components/OledSimulator";
import { LogsConsole, type LogEntry } from "@/components/LogsConsole";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Echo Face" },
      { name: "description", content: "Realtime lip-reading dashboard with ESP32-S3 controls." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [running, setRunning] = useState(false);
  const [mouth, setMouth] = useState(0);
  const [lipText, setLipText] = useState("Echo standing by");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logRef = useRef(logs);
  logRef.current = logs;

  const log = (level: LogEntry["level"], msg: string) =>
    setLogs((l) => [...l.slice(-200), { t: Date.now(), level, msg }]);

  useEffect(() => {
    log("info", "Dashboard initialized");
    log("info", "Loading lip-reading model… ready");
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Control Center
            </div>
            <h1 className="font-display text-3xl md:text-4xl neon-text">Live Dashboard</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setRunning((r) => {
                  log(r ? "warn" : "info", r ? "Listening stopped" : "Listening started");
                  return !r;
                });
              }}
              className={running ? "btn-ghost" : "btn-neon"}
            >
              <Power className="h-4 w-4" />
              {running ? "Stop Listening" : "Start Listening"}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <CameraFeed running={running} onMouthOpen={setMouth} />
            <div className="grid md:grid-cols-2 gap-5">
              <LipReadPanel
                mouthOpen={mouth}
                active={running}
                onText={(t) => {
                  setLipText(t);
                  log("info", `Lip recognized: "${t}"`);
                }}
              />
              <MicPanel onTranscript={(t) => log("info", `Mic: ${t.slice(-40)}`)} />
            </div>
            <AIResponsePanel incoming={lipText} />
          </div>

          <div className="space-y-5">
            <DeviceStatusCard />
            <OledSimulator text={lipText} />
            <LogsConsole logs={logs} />
          </div>
        </div>
      </main>
    </div>
  );
}

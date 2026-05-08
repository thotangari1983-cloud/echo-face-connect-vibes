import { useEffect, useRef, useState } from "react";
import { Terminal } from "lucide-react";

export type LogEntry = { t: number; level: "info" | "warn" | "err"; msg: string };

const colors = {
  info: "text-primary",
  warn: "text-warning",
  err: "text-destructive",
} as const;

export function LogsConsole({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (auto) ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [logs, auto]);
  return (
    <div className="glass p-4 h-full flex flex-col min-h-64">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            System Logs
          </span>
        </div>
        <label className="text-[10px] text-muted-foreground flex items-center gap-1">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
          />
          Auto-scroll
        </label>
      </div>
      <div
        ref={ref}
        className="flex-1 overflow-y-auto rounded-md bg-black/40 border border-border p-3 font-mono text-[11px] leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground">// no events</div>
        ) : (
          logs.map((l, i) => (
            <div key={i}>
              <span className="text-muted-foreground">
                [{new Date(l.t).toLocaleTimeString()}]
              </span>{" "}
              <span className={colors[l.level]}>{l.level.toUpperCase()}</span>{" "}
              <span className="text-foreground/90">{l.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

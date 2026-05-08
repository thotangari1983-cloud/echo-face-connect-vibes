import { useEffect, useState } from "react";

type Props = { text: string };

export function OledSimulator({ text }: Props) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [text]);

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          OLED Display · 128×64
        </span>
        <span className="status-dot online" />
      </div>
      <div className="rounded-md bg-black border border-border p-3 font-mono text-[13px] leading-tight text-cyan-300 min-h-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background:
            "repeating-linear-gradient(transparent 0 2px, rgba(0,0,0,0.35) 2px 3px)",
        }} />
        <div className="relative">
          <div className="flex justify-between text-[10px] text-cyan-500/80">
            <span>ECHO//OS</span>
            <span>● LIVE</span>
          </div>
          <div className="mt-1 break-words">{shown}<span className="animate-pulse">▌</span></div>
        </div>
      </div>
    </div>
  );
}

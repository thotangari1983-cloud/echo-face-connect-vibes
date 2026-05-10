import { useEffect, useRef, useState } from "react";
import { Bot, Volume2, VolumeX } from "lucide-react";
import { echofaceApi } from "@/lib/echoface-backend";

type Msg = { id: string; role: "user" | "ai"; text: string };

const replies: Record<string, string> = {
  hello: "Hello, I'm Echo. Standing by.",
  open: "Door command relayed to ESP32.",
  increase: "Volume increased to 80 percent.",
  diagnostics: "All systems nominal. Latency 12 ms.",
  status: "Status report dispatched.",
  silent: "Silent mode engaged.",
  connect: "Pairing handshake initiated.",
};

function reply(text: string) {
  const k = text.toLowerCase();
  for (const key of Object.keys(replies)) if (k.includes(key)) return replies[key];
  return `Acknowledged: “${text}”. Forwarding to assistant.`;
}

type Props = { incoming?: string };

export function AIResponsePanel({ incoming }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: "0", role: "ai", text: "Echo online. Awaiting input." },
  ]);
  const [voice, setVoice] = useState(false);
  const voiceRef = useRef(false);
  const lastRef = useRef<string>("");
  const endRef = useRef<HTMLDivElement>(null);

  const toggleVoice = () => {
    const next = !voice;
    setVoice(next);
    voiceRef.current = next;
    // Unlock speechSynthesis inside the user gesture (required on mobile).
    if (next && typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const primer = new SpeechSynthesisUtterance("Voice on");
        primer.volume = 1;
        primer.rate = 1.05;
        window.speechSynthesis.speak(primer);
      } catch {
        /* ignore */
      }
    } else if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  useEffect(() => {
    if (!incoming || incoming === lastRef.current) return;
    lastRef.current = incoming;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: incoming };
    setMsgs((m) => [...m, userMsg]);

    let cancelled = false;
    (async () => {
      // Try Python backend (Gemini). Fall back to local canned reply.
      let r: string;
      try {
        r = await echofaceApi.chat(incoming);
        if (!r) throw new Error("empty");
      } catch {
        r = reply(incoming);
      }
      if (cancelled) return;
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "ai", text: r }]);
      if (voiceRef.current) {
        // Prefer backend Coqui TTS; fall back to browser speechSynthesis.
        try {
          await echofaceApi.tts(r);
        } catch {
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            const u = new SpeechSynthesisUtterance(r);
            u.rate = 1.05;
            window.speechSynthesis.speak(u);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [incoming]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  return (
    <div className="glass p-4 flex flex-col h-full min-h-80">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-pulse-glow">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            AI Response
          </span>
        </div>
        <button onClick={toggleVoice} className="btn-ghost">
          {voice ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          {voice ? "Voice On" : "Muted"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
              m.role === "ai"
                ? "bg-primary/10 border border-primary/20 text-foreground"
                : "ml-auto bg-accent/15 border border-accent/25 text-foreground"
            }`}
          >
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

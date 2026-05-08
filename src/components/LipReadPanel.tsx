import { useEffect, useState } from "react";
import { Brain, Sparkles } from "lucide-react";

type Props = { mouthOpen: number; onText?: (text: string) => void };

const phrases = [
  "Hello there",
  "How are you today",
  "Open the lab door",
  "Increase volume",
  "Show me the diagnostics",
  "Send a status report",
  "Activate silent mode",
  "Connect to ESP32",
];

export function LipReadPanel({ mouthOpen, onText }: Props) {
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState(0);

  useEffect(() => {
    // Placeholder lip-reading: cycle phrases with confidence proportional to mouth movement.
    const id = setInterval(() => {
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      setText(phrase);
      setConfidence(Math.round((0.55 + mouthOpen * 0.4) * 100));
      onText?.(phrase);
    }, 3500);
    return () => clearInterval(id);
  }, [mouthOpen, onText]);

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Recognized Lip Text
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">MediaPipe · LipNet</span>
      </div>
      <div className="font-display text-2xl neon-text min-h-10">
        {text || "—"}
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          <span>Confidence</span>
          <span>{confidence}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Brain className="h-3.5 w-3.5" /> Mouth aperture: {(mouthOpen * 100).toFixed(0)}%
      </div>
    </div>
  );
}

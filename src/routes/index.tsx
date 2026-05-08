import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cpu, Eye, Radio, Sparkles, Wifi } from "lucide-react";
import { ParticleField } from "@/components/ParticleField";
import { SiteHeader } from "@/components/SiteHeader";
import { DeviceStatusCard } from "@/components/DeviceStatusCard";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <ParticleField />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-32">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[11px] uppercase tracking-[0.3em] text-muted-foreground mb-6">
                <span className="status-dot online" /> System Online · v1.0
              </div>
              <h1 className="font-display text-6xl md:text-7xl leading-[0.95]">
                <span className="neon-text">Echo Face</span>
              </h1>
              <p className="mt-4 font-display text-xl md:text-2xl text-muted-foreground tracking-wide">
                A Silent Assistant for Communication
              </p>
              <p className="mt-6 max-w-xl text-base text-muted-foreground leading-relaxed">
                Lip-reading AI fused with ESP32-S3 hardware. Speak without sound.
                Echo watches, understands, and responds — through OLED, speaker,
                or the hand of a machine.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link to="/dashboard" className="btn-neon">
                  Start Assistant <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/connect" className="btn-ghost">
                  <Wifi className="h-4 w-4" /> Pair ESP32-S3
                </Link>
              </div>

              <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-xl">
                <DeviceStatusCard />
                <div className="glass p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                    <Radio className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">
                      WebSocket
                    </div>
                    <div className="font-display text-sm">Realtime · 12ms</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hero orb */}
            <div className="relative aspect-square max-w-md mx-auto">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 blur-3xl animate-pulse-glow" />
              <div className="absolute inset-8 rounded-full border border-primary/30 animate-orbit" />
              <div className="absolute inset-16 rounded-full border border-accent/30 animate-orbit" style={{ animationDirection: "reverse", animationDuration: "10s" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-48 w-48 rounded-full glass-strong flex items-center justify-center animate-float">
                  <div className="text-center">
                    <Sparkles className="h-10 w-10 mx-auto text-primary mb-2" />
                    <div className="font-display text-xs uppercase tracking-[0.4em] text-muted-foreground">
                      Neural
                    </div>
                    <div className="font-display text-2xl neon-text">CORE</div>
                  </div>
                  {/* orbiting nodes */}
                  {[0, 60, 120, 180, 240, 300].map((d) => (
                    <div
                      key={d}
                      className="absolute h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_currentColor]"
                      style={{
                        top: "50%",
                        left: "50%",
                        transform: `rotate(${d}deg) translateX(110px)`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative mx-auto max-w-7xl px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <Feature
            icon={<Eye className="h-5 w-5" />}
            title="Lip-Reading AI"
            text="MediaPipe FaceMesh + LipNet inference pipeline reads your mouth in real time."
          />
          <Feature
            icon={<Cpu className="h-5 w-5" />}
            title="ESP32-S3 Bridge"
            text="WebSocket and REST channels stream commands to OLED + speaker outputs."
          />
          <Feature
            icon={<Sparkles className="h-5 w-5" />}
            title="Silent Conversation"
            text="No microphone needed. Talk through movement, listen through machine."
          />
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground tracking-widest uppercase">
        Echo Face // Silent Communication Lab · 2026
      </footer>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="glass p-6 group hover:translate-y-[-4px] transition">
      <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-4 group-hover:animate-pulse-glow">
        {icon}
      </div>
      <h3 className="font-display text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

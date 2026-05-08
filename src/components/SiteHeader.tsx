import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/40 border-b border-border">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative h-9 w-9 rounded-lg neon-border animate-pulse-glow flex items-center justify-center bg-background/50">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg neon-text">ECHO FACE</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Silent Assistant
            </div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/connect">ESP32 Connect</NavLink>
        </nav>
        <Link to="/dashboard" className="btn-neon text-xs">
          Launch
        </Link>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "text-primary" }}
      className="px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition uppercase tracking-widest text-xs"
    >
      {children}
    </Link>
  );
}

import { ReactNode, useState } from "react";
import { MobileTabBar, MobileTopBar, Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

const COLLAPSE_KEY = "booqi.nav.collapsed";

export function AppLayout({ children }: AppLayoutProps) {
  // Remembered per browser; storage can be blocked (private mode), so never trust it.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* per-browser convenience only */
      }
      return !c;
    });

  return (
    <div className="flex h-[100dvh] bg-[rgb(var(--reg-canvas))]">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        {/* On a phone the floating tab bar sits over the bottom; keep content clear of it. */}
        <main className="min-h-0 flex-1 overflow-auto bg-[#fafafa] pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    // Sticky, so the page's own actions stay reachable on a long list, and light rather
    // than another grey band: the pages under it were all the same flat grey, which is
    // what made every screen look like the last one.
    <header className={cn(
      // flex-wrap: on a phone the actions drop under the title instead of off the screen.
      "sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/60 bg-white/90 px-4 py-4 backdrop-blur-md sm:px-6",
      className
    )}>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

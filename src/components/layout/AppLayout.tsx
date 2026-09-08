import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="h-screen bg-background relative">
      <Sidebar />
      <main className="absolute left-[72px] right-0 top-0 bottom-0 bg-[#fafafa] overflow-auto">
        {children}
      </main>
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
      "sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border/60 bg-white/90 px-6 py-4 backdrop-blur-md",
      className
    )}>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

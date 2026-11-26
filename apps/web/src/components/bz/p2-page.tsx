import type { ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BzScope } from "./Shell";

/** Ported-page wrapper: keeps the app AppLayout, renders the artifact `.dsh > .mainx` page body. */
export function BzPage({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return (
    <AppLayout>
      <BzScope>
        <div className="dsh bz-surface bz-live">
          <div className="mainx">{children}</div>
          {overlay}
        </div>
      </BzScope>
    </AppLayout>
  );
}

/** Two-letter initials for `.ring` avatars. */
export const initialsOf = (name?: string | null) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

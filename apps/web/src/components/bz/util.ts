import type { CSSProperties, ReactNode } from "react";

/** Class-name joiner (falsy parts dropped). */
export const cx = (...p: Array<string | false | null | undefined>) => p.filter(Boolean).join(" ");

export type Style = CSSProperties;
export type Kids = { children?: ReactNode };

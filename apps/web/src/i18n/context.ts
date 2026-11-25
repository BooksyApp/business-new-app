import { createContext } from "react";
import type { HubLocale } from "@/lib/hubLocale";

export const I18nContext = createContext<HubLocale>("az");

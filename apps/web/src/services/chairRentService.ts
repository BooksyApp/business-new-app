import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** FG-W5-02: the renter's rent terms. WEEKLY dueDay is the ISO weekday (1-7); MONTHLY is the day of month (1-28). */
export interface ChairRental {
  period: "WEEKLY" | "MONTHLY";
  amount: number;
  dueDay: number;
  startsOn: string;
  active: boolean;
}

export interface ChairRentRow {
  dueOn: string;
  amount: number;
  status: "PAID" | "DUE" | "OVERDUE";
  paidOn?: string | null;
  method?: string | null;
}

export interface ChairRentLedger {
  rental: ChairRental | null;
  overdueCount: number;
  rows: ChairRentRow[];
}

/** renter false stops the rent and keeps its history. */
export interface ChairRentTerms {
  renter: boolean;
  period?: "WEEKLY" | "MONTHLY";
  amount?: number;
  dueDay?: number;
  startsOn?: string;
}

export interface ChairRentPayment {
  dueOn: string;
  paidOn: string;
  method: "CASH" | "CARD" | "TRANSFER";
}

const base = (businessId: Id, staffId: Id) => `/staff/business/${businessId}/${staffId}/chair-rent`;

export const chairRentService = {
  get: (businessId: Id, staffId: Id) => apiClient.get<ChairRentLedger>(base(businessId, staffId)),
  save: (businessId: Id, staffId: Id, terms: ChairRentTerms) =>
    apiClient.put<ChairRentLedger>(base(businessId, staffId), terms),
  markPaid: (businessId: Id, staffId: Id, payment: ChairRentPayment) =>
    apiClient.post<ChairRentLedger>(`${base(businessId, staffId)}/payments`, payment),
};

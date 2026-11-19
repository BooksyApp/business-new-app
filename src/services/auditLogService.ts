import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

/**
 * One row of the salon's audit log: a write the salon made (who, when, what). Rows come from
 * `SELECT` on audit_log, hence the snake_case fields. The server only answers the salon's owner.
 */
export interface AuditLogEntry {
  actor_user_id: Id | null;
  actor_name: string | null;
  method: string;
  entity_type: string | null;
  entity_id: string | null;
  path: string;
  status: number;
  summary: string | null;
  created_at: string;
}

export interface AuditLogFilter {
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd, inclusive
  actor?: string; // part of the actor's name
  limit?: number;
  offset?: number;
}

export const auditLogService = {
  list(businessId: Id, f: AuditLogFilter): Promise<AuditLogEntry[]> {
    const p = new URLSearchParams();
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    if (f.actor?.trim()) p.set("actor", f.actor.trim());
    p.set("limit", String(f.limit ?? 50));
    p.set("offset", String(f.offset ?? 0));
    return apiClient.get<AuditLogEntry[]>(`/businesses/${businessId}/audit-log?${p.toString()}`);
  },
};

/**
 * Pure helpers for a live message thread (FG-W4-04): optimistic send, pushed messages and
 * refetches all feed one list without duplicating or losing a message.
 */
export interface ThreadMessage {
  messageId: string;
  fromSalon: boolean;
  body: string;
  sentAt: string;
  /** Only on a message this client has not had confirmed (or failed): never from the server. */
  status?: "sending" | "failed";
}

export const LOCAL_PREFIX = "local-";

export const isLocal = (m: ThreadMessage) => m.messageId.startsWith(LOCAL_PREFIX);

/** A message this client just typed, shown before the server has answered. */
export function localMessage<M extends ThreadMessage>(id: string, fromSalon: boolean, body: string): M {
  return { messageId: `${LOCAL_PREFIX}${id}`, fromSalon, body, sentAt: new Date().toISOString(), status: "sending" } as M;
}

/** Drops one unconfirmed local copy that a confirmed message of the same side and text replaces. */
function dropMatchingLocal<M extends ThreadMessage>(list: M[], confirmed: M): M[] {
  const i = list.findIndex((m) => isLocal(m) && m.status === "sending" && m.fromSalon === confirmed.fromSalon && m.body === confirmed.body);
  return i < 0 ? list : list.filter((_, k) => k !== i);
}

/** A message pushed over the socket (or any server copy): ignored if already present. */
export function applyIncoming<M extends ThreadMessage>(list: M[], incoming: M): M[] {
  if (list.some((m) => m.messageId === incoming.messageId)) return list;
  return [...dropMatchingLocal(list, incoming), incoming];
}

/** The send call answered: the local copy becomes the server's (or goes, if the push beat it). */
export function resolveSent<M extends ThreadMessage>(list: M[], localId: string, server: M): M[] {
  if (list.some((m) => m.messageId === server.messageId)) return list.filter((m) => m.messageId !== localId);
  return list.map((m) => (m.messageId === localId ? server : m));
}

export function markStatus<M extends ThreadMessage>(list: M[], localId: string, status: "sending" | "failed"): M[] {
  return list.map((m) => (m.messageId === localId ? { ...m, status } : m));
}

/**
 * A full refetch: the server's list wins, but a message still being sent, or failed, stays at the
 * end. A pending one whose twin has just shown up in the server list is not kept twice.
 */
export function mergeServer<M extends ThreadMessage>(prev: M[], server: M[]): M[] {
  const known = new Set(prev.filter((m) => !isLocal(m)).map((m) => m.messageId));
  let fresh = server.filter((m) => !known.has(m.messageId));
  const keep: M[] = [];
  for (const m of prev) {
    if (!isLocal(m)) continue;
    if (m.status === "sending") {
      const i = fresh.findIndex((s) => s.fromSalon === m.fromSalon && s.body === m.body);
      if (i >= 0) {
        fresh = fresh.filter((_, k) => k !== i);
        continue;
      }
    }
    keep.push(m);
  }
  return [...server, ...keep];
}

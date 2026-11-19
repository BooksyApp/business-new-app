import { describe, expect, it } from "vitest";
import {
  applyIncoming,
  localMessage,
  markStatus,
  mergeServer,
  resolveSent,
  type ThreadMessage,
} from "./messageThread";

const srv = (id: string, body: string, fromSalon = true): ThreadMessage => ({
  messageId: id,
  fromSalon,
  body,
  sentAt: "2026-11-19T10:00:00",
});

describe("messageThread", () => {
  it("shows a typed message at once and swaps in the server copy", () => {
    const local = localMessage("1", true, "salam");
    let list = [srv("a", "hi", false), local];
    list = resolveSent(list, local.messageId, srv("m1", "salam"));
    expect(list.map((m) => m.messageId)).toEqual(["a", "m1"]);
    expect(list[1].status).toBeUndefined();
  });

  it("does not duplicate when the push arrives before the send response", () => {
    const local = localMessage("1", true, "salam");
    let list = applyIncoming([local], srv("m1", "salam"));
    expect(list.map((m) => m.messageId)).toEqual(["m1"]);
    list = resolveSent(list, local.messageId, srv("m1", "salam"));
    expect(list.map((m) => m.messageId)).toEqual(["m1"]);
  });

  it("ignores a message it already has and keeps the other side's text", () => {
    const list = [srv("m1", "x")];
    expect(applyIncoming(list, srv("m1", "x"))).toBe(list);
    expect(applyIncoming(list, srv("m2", "x", false)).map((m) => m.messageId)).toEqual(["m1", "m2"]);
  });

  it("keeps a failed message through a refetch and marks it for retry", () => {
    const local = localMessage("1", true, "oops");
    const failed = markStatus([local], local.messageId, "failed");
    const merged = mergeServer(failed, [srv("a", "hi", false)]);
    expect(merged.map((m) => m.messageId)).toEqual(["a", local.messageId]);
    expect(merged[1].status).toBe("failed");
  });

  it("a refetch does not double a pending message whose twin just arrived", () => {
    const local = localMessage("1", true, "salam");
    const merged = mergeServer([srv("a", "hi", false), local], [srv("a", "hi", false), srv("m1", "salam")]);
    expect(merged.map((m) => m.messageId)).toEqual(["a", "m1"]);
  });
});

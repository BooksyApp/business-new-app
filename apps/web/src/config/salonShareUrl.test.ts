import { describe, expect, it } from "vitest";
import { salonShareUrl } from "@/config/api";

describe("salonShareUrl", () => {
  it("tags the booking link with the social channel", () => {
    expect(salonShareUrl("https://x.test/salon/a", "instagram")).toBe("https://x.test/salon/a?src=instagram");
    expect(salonShareUrl("https://x.test/salon/a?lang=az", "facebook")).toBe("https://x.test/salon/a?lang=az&src=facebook");
  });
});

import { describe, expect, it } from "vitest";
import { CTA, DEFAULTS, PILL, SCAN, SLOTS_LABEL, SOCIAL_LANGS, SOCIAL_TEMPLATES } from "./socialCopy";
import { parseSlots, socialLink, SOCIAL_SIZES } from "./socialImages";

describe("social images", () => {
  it("the booking link carries src=social", () => {
    expect(socialLink("https://getbooqi.tech/salon/aysel-beauty")).toBe("https://getbooqi.tech/salon/aysel-beauty?src=social");
    expect(socialLink("https://x.test/salon/a?lang=az")).toBe("https://x.test/salon/a?lang=az&src=social");
    expect(socialLink("")).toBe("");
  });

  it("both sizes are the Instagram ones", () => {
    expect(SOCIAL_SIZES.story).toEqual({ w: 1080, h: 1920 });
    expect(SOCIAL_SIZES.post).toEqual({ w: 1080, h: 1080 });
  });

  it("open times: valid HH:MM only, de-duplicated, at most six", () => {
    expect(parseSlots("11:00, 9.30; 25:00 abc 11:00 13:45")).toEqual(["11:00", "09:30", "13:45"]);
    expect(parseSlots("10:00 11:00 12:00 13:00 14:00 15:00 16:00")).toHaveLength(6);
  });

  it("every template has copy in az, en and ru", () => {
    for (const lang of SOCIAL_LANGS) {
      expect(CTA[lang]).toBeTruthy();
      expect(SCAN[lang]).toBeTruthy();
      expect(SLOTS_LABEL[lang]).toBeTruthy();
      for (const tpl of SOCIAL_TEMPLATES) {
        expect(PILL[tpl][lang]).toBeTruthy();
        expect(DEFAULTS[tpl][lang].headline).toBeTruthy();
      }
    }
  });
});

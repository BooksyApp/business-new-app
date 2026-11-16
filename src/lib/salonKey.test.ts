import { beforeEach, describe, expect, it } from "vitest";
import { forgetSalons, idForKey, isSalonKey, keyForId, publicIdOf, rememberSalons, salonPath } from "./salonKey";

const U = "3f0c1d2e-0000-4000-8000-000000000007";

describe("salon panel keys", () => {
  beforeEach(() => forgetSalons());

  it("finds the UUID at the end of a key, and only there", () => {
    expect(publicIdOf(`baki-sac_${U}`)).toBe(U);
    expect(publicIdOf(U.toUpperCase())).toBe(U);
    expect(isSalonKey("login")).toBe(false);
    expect(isSalonKey("12")).toBe(false);
    expect(isSalonKey(`x${U}`)).toBe(false);
  });

  it("maps keys and ids the server told us about, by UUID whatever the name part", () => {
    rememberSalons([{ id: 7, publicId: U, panelKey: `baki-sac_${U}` }]);
    expect(idForKey(`old-name_${U}`)).toBe(7);
    expect(keyForId(7)).toBe(`baki-sac_${U}`);
    expect(salonPath(7)).toBe(`/baki-sac_${U}/calendar`);
    expect(salonPath(7, "/roles")).toBe(`/baki-sac_${U}/roles`);
    // Never the numeric id: an unknown salon goes to the picker.
    expect(salonPath(8)).toBe("/");
  });

  it("forgets everything on sign-out", () => {
    rememberSalons([{ id: 7, publicId: U, panelKey: `s_${U}` }]);
    forgetSalons();
    expect(idForKey(`s_${U}`)).toBeUndefined();
  });
});

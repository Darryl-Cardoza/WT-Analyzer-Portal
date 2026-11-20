import { describe, expect, it } from "vitest";
import { fallOutcome } from "./alerts";

describe("fallOutcome", () => {
  it("maps review outcome to a label and a distinct colour", () => {
    expect(fallOutcome(false).label).toBe("True fall");
    expect(fallOutcome(true).label).toBe("False positive");
    expect(fallOutcome(null).label).toBe("Not acknowledged");
    expect(new Set([false, true, null].map((v) => fallOutcome(v).color)).size).toBe(3);
  });
});

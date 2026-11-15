import { describe, expect, it } from "vitest";
import {
  daysUntil,
  nextOccurrence,
  parseDateOnly
} from "../../server/src/services/dates";

describe("annual date calculations", () => {
  it("moves a yearly date to next year after it has passed", () => {
    expect(nextOccurrence("2020-03-05", true, new Date(2026, 10, 15, 12))).toBe(
      "2027-03-05"
    );
  });

  it("keeps a yearly date in the current year when it is still ahead", () => {
    expect(nextOccurrence("2020-12-02", true, new Date(2026, 10, 15, 12))).toBe(
      "2026-12-02"
    );
  });

  it("uses February 28 for a yearly February 29 date in a non-leap year", () => {
    expect(nextOccurrence("2024-02-29", true, new Date(2027, 0, 1, 12))).toBe(
      "2027-02-28"
    );
  });

  it("keeps a non-repeating date only while it is not in the past", () => {
    expect(nextOccurrence("2026-12-02", false, new Date(2026, 10, 15, 12))).toBe(
      "2026-12-02"
    );
    expect(nextOccurrence("2026-10-02", false, new Date(2026, 10, 15, 12))).toBeNull();
  });

  it("calculates the number of calendar days from today", () => {
    expect(daysUntil("2026-11-18", new Date(2026, 10, 15, 23))).toBe(3);
    expect(parseDateOnly("2026-11-18")).toEqual({ year: 2026, month: 11, day: 18 });
  });
});

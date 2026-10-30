import { describe, expect, it } from "vitest";

import { asHours, dayName, EMPTY_HOURS, formatTime, hourRuns, openStatus, type Hours } from "./hours";

const daily: Hours = asHours({
  mon: [["07:00", "22:00"]],
  tue: [["07:00", "22:00"]],
  wed: [["07:00", "22:00"]],
  thu: [["07:00", "22:00"]],
  fri: [["07:00", "22:00"]],
  sat: [["07:00", "13:00"], ["16:00", "22:00"]],
  sun: [],
});

// Times are UTC; India is UTC+5:30. 2026-10-29 is a Thursday.
const ist = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`);

describe("open now (doc 06 OpenNowBadge)", () => {
  it("is open inside today's hours, in India time", () => {
    expect(openStatus(daily, ist("2026-10-29", "09:30"))).toEqual({ open: true, closesAt: "22:00" });
  });

  it("before opening says when it opens today", () => {
    expect(openStatus(daily, ist("2026-10-29", "06:15"))).toEqual({ open: false, opensAt: "07:00", opensDay: "thu" });
  });

  it("handles a lunch break", () => {
    expect(openStatus(daily, ist("2026-10-31", "14:00"))).toEqual({ open: false, opensAt: "16:00", opensDay: "sat" });
    expect(openStatus(daily, ist("2026-10-31", "16:30"))).toEqual({ open: true, closesAt: "22:00" });
  });

  it("after closing skips a closed Sunday to Monday", () => {
    expect(openStatus(daily, ist("2026-10-31", "23:00"))).toEqual({ open: false, opensAt: "07:00", opensDay: "mon" });
  });

  it("says nothing about opening when no hours are set", () => {
    expect(openStatus(EMPTY_HOURS, ist("2026-10-29", "12:00"))).toEqual({ open: false, opensAt: null, opensDay: null });
  });
});

describe("hours display", () => {
  it("groups days with the same hours", () => {
    expect(hourRuns(daily)).toEqual([
      { from: "mon", to: "fri", slots: [["07:00", "22:00"]] },
      { from: "sat", to: "sat", slots: [["07:00", "13:00"], ["16:00", "22:00"]] },
      { from: "sun", to: "sun", slots: [] },
    ]);
  });

  it("reads stored hours safely, whatever their shape", () => {
    expect(asHours(null)).toEqual(EMPTY_HOURS);
    expect(asHours({ mon: [["07:00", "22:00"], ["bad"]], tue: "x" }).mon).toEqual([["07:00", "22:00"]]);
  });

  it("names days and times in both languages", () => {
    expect(dayName("mon", "en")).toBe("Mon");
    expect(dayName("mon", "hi")).toBe("सोम");
    expect(formatTime("07:00", "en")).toMatch(/^7:00\sam$/i);
    expect(formatTime("22:30", "en")).toMatch(/^10:30\spm$/i);
  });
});

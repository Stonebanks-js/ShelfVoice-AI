import { describe, expect, it } from "vitest";

import { ApiFailure } from "@/lib/api";

import { isConnectionProblem, isRetryable, retryDelayMs } from "./clip-queue";

describe("offline clip queue rules (F-03b)", () => {
  it("backs off from 5 seconds to at most 5 minutes", () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([5_000, 10_000, 20_000, 40_000]);
    expect(retryDelayMs(20)).toBe(300_000);
  });

  it("queues a clip only when the connection is the problem", () => {
    expect(isConnectionProblem(new ApiFailure(0, "OFFLINE", "x"))).toBe(true);
    expect(isConnectionProblem(new ApiFailure(0, "UPLOAD_TIMEOUT", "x"))).toBe(true);
    expect(isConnectionProblem(new ApiFailure(503, "AI_UNAVAILABLE", "x"))).toBe(false);
    expect(isConnectionProblem(new Error("x"))).toBe(false);
  });

  it("keeps retrying what waiting can fix, and gives up on the rest", () => {
    for (const error of [
      new ApiFailure(0, "OFFLINE", "x"),
      new ApiFailure(503, "AI_PAUSED", "x"),
      new ApiFailure(429, "RATE_LIMITED", "x"),
      new ApiFailure(401, "UNAUTHENTICATED", "x"),
      new ApiFailure(400, "UPLOAD_FAILED", "x"),
    ]) {
      expect(isRetryable(error)).toBe(true);
    }
    for (const error of [new ApiFailure(422, "NOTHING_HEARD", "x"), new ApiFailure(422, "BAD_AUDIO", "x"), new ApiFailure(422, "AI_NOT_UNDERSTOOD", "x")]) {
      expect(isRetryable(error)).toBe(false);
    }
  });
});

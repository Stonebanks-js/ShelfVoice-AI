import { describe, expect, it } from "vitest";

import { fitWithin } from "./image";

describe("photo size (doc 02: 1600 px longest side)", () => {
  it.each([
    [4032, 3024, 1600, 1200], // a 12 MP phone photo, landscape
    [3024, 4032, 1200, 1600], // the same, portrait
    [1200, 900, 1200, 900], // already small: never enlarged
    [5000, 100, 1600, 32], // a long receipt strip keeps its shape
  ])("%i x %i becomes %i x %i", (w, h, ew, eh) => {
    expect(fitWithin(w, h)).toEqual({ width: ew, height: eh });
  });
});

import { describe, expect, it } from "bun:test";
import { PdpTarget } from "@/components/pdp/pdp-target";
import { PdpProblem } from "@/components/pdp/pdp-problem";
import { PdpMoments } from "@/components/pdp/pdp-moments";

describe("PDP server sections", () => {
  it("PdpTarget exports a function", () => {
    expect(typeof PdpTarget).toBe("function");
  });
  it("PdpProblem exports a function", () => {
    expect(typeof PdpProblem).toBe("function");
  });
  it("PdpMoments exports a function", () => {
    expect(typeof PdpMoments).toBe("function");
  });
});

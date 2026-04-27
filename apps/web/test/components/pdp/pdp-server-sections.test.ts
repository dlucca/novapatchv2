import { describe, expect, it } from "bun:test";
import { PdpTarget } from "@/components/pdp/pdp-target";
import { PdpProblem } from "@/components/pdp/pdp-problem";
import { PdpMoments } from "@/components/pdp/pdp-moments";
import { PdpFormula } from "@/components/pdp/pdp-formula";
import { PdpScience } from "@/components/pdp/pdp-science";
import { PdpPromises } from "@/components/pdp/pdp-promises";
import { PdpClaims } from "@/components/pdp/pdp-claims";

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
  it("PdpFormula exports a function", () => {
    expect(typeof PdpFormula).toBe("function");
  });
  it("PdpScience exports a function", () => {
    expect(typeof PdpScience).toBe("function");
  });
  it("PdpPromises exports a function", () => {
    expect(typeof PdpPromises).toBe("function");
  });
  it("PdpClaims exports a function", () => {
    expect(typeof PdpClaims).toBe("function");
  });
});

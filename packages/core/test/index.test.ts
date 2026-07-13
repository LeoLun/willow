import { describe, expect, it } from "vitest";
import { createAgent } from "../src/index";

describe("createAgent", () => {
  it("creates an agent that echoes input with its name", () => {
    const agent = createAgent({ name: "willow" });

    expect(agent.name).toBe("willow");
    expect(agent.run("hello")).toBe("willow: hello");
  });
});

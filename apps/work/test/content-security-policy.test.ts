import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("renderer content security policy", () => {
  it("allows blob URLs for clipboard image previews", async () => {
    const indexPath = fileURLToPath(new URL("../index.html", import.meta.url));
    const html = await readFile(indexPath, "utf8");
    const policy = html.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/)?.[1];

    expect(policy).toBeDefined();
    expect(policy?.match(/img-src ([^;]+)/)?.[1].split(/\s+/)).toContain("blob:");
  });
});

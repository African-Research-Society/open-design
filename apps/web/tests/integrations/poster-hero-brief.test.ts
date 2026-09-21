import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const skill = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../skills/poster-hero/SKILL.md",
  ),
  "utf8",
);

describe("poster-hero ARS brief frames", () => {
  it("honors Format from brief.txt instead of locking every poster to 1080×1920", () => {
    expect(skill).toMatch(/Format:\s*WIDTHxHEIGHT/i);
    expect(skill).toMatch(/1920×1080|1920x1080/);
    expect(skill).toMatch(/brief\.txt/);
    expect(skill).toMatch(/Do not invent quotes/i);
  });
});

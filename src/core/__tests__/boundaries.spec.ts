import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = [
  /from\s+["']@\/core\/reducers/,
  /from\s+["']@\/core\/events/,
  /from\s+["']@\/core\/adapters/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("surface → core boundary", () => {
  it("no page or component imports from @/core internals", () => {
    const files = [
      ...walk("src/pages"),
      ...walk("src/components"),
    ];
    const violations: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const rx of FORBIDDEN) {
        if (rx.test(src)) violations.push(`${f} matches ${rx}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

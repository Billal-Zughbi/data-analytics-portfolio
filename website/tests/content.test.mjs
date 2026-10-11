import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const summary = JSON.parse(readFileSync(new URL("../src/data/apple-health-summary.json", import.meta.url)));

test("apple health summary has the fields the case study renders", () => {
  for (const key of ["dataSource", "recordsProcessed", "firstMonth", "lastMonth", "kpis", "monthly"]) {
    assert.ok(key in summary, `missing ${key}`);
  }
  assert.ok(summary.monthly.steps.length > 0);
  assert.ok(summary.monthly.restingHeartRate.length > 0);
  for (const p of summary.monthly.steps) assert.match(p.month, /^\d{4}-\d{2}$/);
});

test("summary is aggregate-only (no daily or identifying fields)", () => {
  const text = JSON.stringify(summary);
  for (const needle of ["sourceName", "device", "HKDevice", "creationDate", "startDate", "endDate"]) {
    assert.ok(!text.includes(needle), `summary contains ${needle}`);
  }
  assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}/, "summary should not contain daily dates");
});

test("site source does not publish a phone number", () => {
  const walk = (dir) =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  for (const file of walk(new URL("../src", import.meta.url).pathname)) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/, file);
  }
});

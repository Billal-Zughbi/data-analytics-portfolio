// Content and privacy contracts for the public site. Run with `npm test`.
// The `out/` checks run only after `npm run build`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const generated = join(root, "src/data/generated/apple-health");
const out = join(root, "out");

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const summary = JSON.parse(readFileSync(join(generated, "summary.json"), "utf8"));
const daily = JSON.parse(readFileSync(join(generated, "daily.json"), "utf8"));

test("summary has the fields the case study renders", () => {
  for (const key of ["source", "headline", "cards", "comparison", "findings", "quality", "yearly", "workouts", "records", "model", "metrics"]) {
    assert.ok(key in summary, `missing ${key}`);
  }
  assert.equal(summary.cards.length, 24);
  assert.ok(summary.cards.every((c) => c.matches), "every original card reproduces");
  for (const f of summary.findings) assert.ok(f.caveat.length > 0 && f.metric.length > 0, `${f.id} needs a method and caveat`);
  assert.ok(summary.quality.checks.every((c) => c.result !== "fail"), "no failed quality checks");
});

test("daily series share one calendar", () => {
  const span = (Date.parse(daily.end) - Date.parse(daily.start)) / 86_400_000 + 1;
  assert.equal(daily.days, span);
  for (const [key, d] of Object.entries(daily.dense)) {
    assert.ok(d.offset >= 0 && d.offset + d.values.length <= daily.days, key);
  }
  for (const [key, pairs] of Object.entries(daily.sparse)) {
    assert.ok(pairs.every(([i]) => i >= 0 && i < daily.days), key);
  }
  assert.equal(summary.source.last_day, daily.end);
});

test("generated data carries no device names or record-level fields", () => {
  for (const file of walk(generated)) {
    const text = readFileSync(file, "utf8");
    for (const needle of ["sourceName", "HKDevice", "creationDate", "startDate", "endDate", "device_class", "source_rank"]) {
      assert.ok(!text.includes(needle), `${file} contains ${needle}`);
    }
    assert.doesNotMatch(text, /[’']s (Apple Watch|iPhone)/, `${file} contains a personal device name`);
    assert.doesNotMatch(text, /\d{2}:\d{2}:\d{2}/, `${file} contains a time of day`);
  }
});

test("site source does not publish a phone number", () => {
  for (const file of walk(join(root, "src"))) {
    if (file.endsWith(".json")) continue;
    assert.doesNotMatch(readFileSync(file, "utf8"), /\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/, file);
  }
});

test("site copy avoids the phrases the brief rules out", () => {
  const banned = /actionable insights|genuinely|messy data|reporting people trust|got hooked|fell in love with the challenge|come say hi/i;
  for (const file of walk(join(root, "src"))) {
    if (file.endsWith(".json")) continue;
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, banned, file);
    assert.doesNotMatch(text, /analytics engineer(ing)?\b/, `${file}: write "Analytics Engineer" with capitals`);
  }
});

test("only the Apple Health case study is published", () => {
  const pages = readdirSync(join(root, "src/app/projects"));
  assert.deepEqual(pages, ["apple-health-analytics"]);
});

const built = existsSync(join(out, "index.html"));

test("static export contains every route", { skip: !built && "run npm run build first" }, () => {
  for (const route of [
    "index.html",
    "projects/apple-health-analytics/index.html",
    "404.html",
  ]) {
    assert.ok(existsSync(join(out, route)), `missing ${route}`);
  }
});

test("internal links in the export resolve to files", { skip: !built && "run npm run build first" }, () => {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  for (const file of walk(out).filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(file, "utf8");
    for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
      const path = href.slice(base.length).replace(/^\//, "");
      const target = path === "" || path.endsWith("/") ? join(out, path, "index.html") : join(out, path);
      assert.ok(existsSync(target), `${file}: broken link ${href}`);
    }
  }
});

test("export ships no source maps, raw health data or Power BI files", { skip: !built && "run npm run build first" }, () => {
  for (const file of walk(out)) {
    assert.doesNotMatch(file, /\.map$|\.pbix$|export\.xml$|HK\w+\.csv$/, file);
  }
});

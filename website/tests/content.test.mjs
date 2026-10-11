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
const weekly = JSON.parse(readFileSync(join(generated, "weekly.json"), "utf8"));

test("Apple Health outputs are labelled synthetic", () => {
  assert.equal(summary.synthetic, true);
  assert.equal(weekly.synthetic, true);
  assert.match(summary.notice, /not real measurements/i);
});

test("summary has the fields the case study renders", () => {
  for (const key of ["period", "metrics", "kpis", "quality", "aggregation_audit"]) {
    assert.ok(key in summary, `missing ${key}`);
  }
  assert.ok(summary.kpis.length >= 8);
  for (const k of summary.kpis) assert.ok(k.definition.length > 20, `${k.key} needs a definition`);
  assert.ok(weekly.rows.length >= 50);
});

test("generated data carries no device names or record-level fields", () => {
  for (const file of walk(generated)) {
    const text = readFileSync(file, "utf8");
    for (const needle of ["sourceName", "Demo Watch", "Demo iPhone", "HKDevice", "creationDate", "startDate", "endDate", "device_class"]) {
      assert.ok(!text.includes(needle), `${file} contains ${needle}`);
    }
    assert.doesNotMatch(text, /[’']s (Apple Watch|iPhone)/, `${file} contains a personal device name`);
  }
});

test("site source does not publish a phone number", () => {
  for (const file of walk(join(root, "src"))) {
    if (file.endsWith(".json")) continue;
    assert.doesNotMatch(readFileSync(file, "utf8"), /\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/, file);
  }
});

const built = existsSync(join(out, "index.html"));

test("static export contains every route", { skip: !built && "run npm run build first" }, () => {
  for (const route of ["index.html", "projects/apple-health-analytics/index.html", "404.html"]) {
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

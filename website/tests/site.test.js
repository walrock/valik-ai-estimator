const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

/**
 * @param {string} relativePath
 */
function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const html = read("index.html");
const css = read("style.css");

test("core sections and controls exist", () => {
  const requiredIds = [
    "top",
    "services",
    "why",
    "process",
    "gallery",
    "galleryGrid",
    "contact",
    "leadForm",
    "lightbox",
    "lightboxImg",
    "lightboxCount",
    "mobileNav",
    "burger",
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id="${id}"`), `Missing id="${id}"`);
  }
});

test("hash links point to existing ids", () => {
  const ids = new Set(
    [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1])
  );
  const hashTargets = [...html.matchAll(/href="#([^"]+)"/g)].map(
    (match) => match[1]
  );

  assert.ok(hashTargets.length > 0, "No hash links found");

  for (const target of hashTargets) {
    assert.ok(ids.has(target), `Missing target for href="#${target}"`);
  }
});

test("gallery contains preview images with full-size links and alt", () => {
  const galleryMatch = html.match(
    /<div class="gallery" id="galleryGrid">([\s\S]*?)<\/div>/
  );

  assert.ok(galleryMatch, "Gallery container #galleryGrid not found");

  const galleryHtml = galleryMatch[1];
  const images = [...galleryHtml.matchAll(/<img\b[^>]*>/g)].map(
    (match) => match[0]
  );

  assert.ok(images.length >= 6, "Expected at least 6 gallery images");

  for (const tag of images) {
    assert.match(tag, /\bdata-full="[^"]+"/, "Gallery image misses data-full");
    assert.match(tag, /\balt="[^"]+"/, "Gallery image misses alt");
  }
});

test("json-ld block is valid and contains business profile fields", () => {
  const jsonLdMatch = html.match(
    /<script type="application\/ld\+json" id="ldJson">\s*([\s\S]*?)\s*<\/script>/
  );

  assert.ok(jsonLdMatch, "JSON-LD block #ldJson not found");

  const parsed = JSON.parse(jsonLdMatch[1]);

  assert.equal(parsed["@type"], "LocalBusiness");
  assert.equal(parsed.name, "Pomorskie Malowania");
  assert.ok(Array.isArray(parsed.areaServed) && parsed.areaServed.length > 0);
  assert.ok(Array.isArray(parsed.sameAs) && parsed.sameAs.length > 0);
});

test("gallery styles stay horizontal", () => {
  assert.match(
    css,
    /\.gallery\s*{[^}]*grid-auto-flow:\s*column;[^}]*}/s,
    "Gallery must use one horizontal row"
  );
  assert.match(
    css,
    /\.gallery\s*{[^}]*overflow-x:\s*auto;[^}]*}/s,
    "Gallery must allow horizontal scrolling"
  );
});

test("script.js passes syntax check", () => {
  const scriptSource = read("script.js");
  assert.doesNotThrow(
    () => new vm.Script(scriptSource, { filename: "script.js" }),
    "script.js has syntax errors"
  );
});

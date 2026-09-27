import assert from "node:assert/strict";
import test from "node:test";
import { getEncodingPreview } from "./encodingPreview.js";

test("encodes ASCII and multibyte Unicode as UTF-8 bytes", () => {
  const preview = getEncodingPreview("A€😀", 2);
  assert.deepEqual(preview.bytes, [0x41, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80]);
});

test("forms continuous modulation groups and pads only the final group", () => {
  const preview = getEncodingPreview("A", 6);
  assert.deepEqual(preview.symbols, ["010000", "010000"]);
});

test("limits display by Unicode code points rather than UTF-16 code units", () => {
  const preview = getEncodingPreview("😀".repeat(11), 2);
  assert.equal(preview.characters.length, 11);
  assert.equal(preview.visibleCharacters.length, 10);
  assert.equal(preview.bytes.length, 40);
});

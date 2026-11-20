import assert from "node:assert/strict";
import test from "node:test";

import { createInputHash } from "../features/ai/hash.ts";

// Regression tests: createInputHash must be environment-independent.
// hash.ts canonicalizes objects before hashing; if key ordering relied on
// String.prototype.localeCompare, the canonical string would depend on the
// runtime's ICU collation and the same input could hash differently on
// another machine. These tests pin the code-point ordering behavior.

const input = { B: 1, a: 2, C: 3, b: 4 };

test("hash does not depend on key insertion order", () => {
  assert.equal(createInputHash({ b: 4, C: 3, a: 2, B: 1 }), createInputHash(input));
});

test("hash does not depend on locale collation", () => {
  const baseline = createInputHash(input);
  const original = String.prototype.localeCompare;
  String.prototype.localeCompare = function (that: string) {
    // A deliberately different collation (reversed code-point order).
    return this < that ? 1 : this > that ? -1 : 0;
  };
  try {
    assert.equal(createInputHash(input), baseline);
  } finally {
    String.prototype.localeCompare = original;
  }
});

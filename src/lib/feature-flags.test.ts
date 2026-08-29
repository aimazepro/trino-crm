// src/lib/feature-flags.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveFeatures } from "./feature-flags.ts";

test("trial plan defaults voip to false", () => {
  assert.equal(effectiveFeatures("trial", null).voip, false);
});

test("pro plan defaults voip to true", () => {
  assert.equal(effectiveFeatures("pro", null).voip, true);
});

test("business plan defaults voip to true", () => {
  assert.equal(effectiveFeatures("business", null).voip, true);
});

test("override turns a feature off even on a plan that includes it", () => {
  assert.equal(effectiveFeatures("pro", { voip: false }).voip, false);
});

test("override turns a feature on even on a plan that excludes it", () => {
  assert.equal(effectiveFeatures("trial", { voip: true }).voip, true);
});

test("unknown plan falls back to trial defaults", () => {
  assert.deepEqual(effectiveFeatures("nonexistent-plan", null), effectiveFeatures("trial", null));
});

test("undefined overrides behave like no overrides", () => {
  assert.deepEqual(effectiveFeatures("pro", undefined), effectiveFeatures("pro", {}));
});

test("every known plan sets a value for every FeatureKey", () => {
  for (const plan of ["trial", "pro", "business"]) {
    const features = effectiveFeatures(plan, null);
    for (const key of ["whatsapp", "voip", "automacoes", "api_v1", "custom_fields"] as const) {
      assert.equal(typeof features[key], "boolean", `${plan}.${key} deveria ser boolean`);
    }
  }
});

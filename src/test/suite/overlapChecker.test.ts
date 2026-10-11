import * as assert from "assert";
import { checkOverlap } from "../../model/overlapChecker";
import { Annotation, makeLineRange } from "../../model/annotation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFolder(
  id: string,
  startLine: number,
  endLine: number,
  note = "test"
): Annotation {
  return {
    id,
    filePath: "root/test.ts",
    range: makeLineRange(startLine, endLine),
    kind: "folder",
    note,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite("OverlapChecker", () => {
  test("no existing folders → ok", () => {
    const result = checkOverlap(makeLineRange(0, 5), []);
    assert.strictEqual(result.kind, "ok");
  });

  test("adjacent ranges (no shared lines) → ok", () => {
    const existing = [makeFolder("a", 0, 4)];
    const result = checkOverlap(makeLineRange(5, 10), existing);
    assert.strictEqual(result.kind, "ok");
  });

  test("identical range → rejected", () => {
    const existing = [makeFolder("a", 10, 20, "Auth helpers")];
    const result = checkOverlap(makeLineRange(10, 20), existing);
    assert.strictEqual(result.kind, "identical");
    if (result.kind === "identical") {
      assert.strictEqual(result.existing.id, "a");
    }
  });

  test("partial overlap (proposed starts inside existing) → rejected", () => {
    const existing = [makeFolder("a", 10, 20)];
    const result = checkOverlap(makeLineRange(15, 25), existing);
    assert.strictEqual(result.kind, "partial");
  });

  test("partial overlap (proposed ends inside existing) → rejected", () => {
    const existing = [makeFolder("a", 10, 20)];
    const result = checkOverlap(makeLineRange(5, 15), existing);
    assert.strictEqual(result.kind, "partial");
  });

  test("proposed fully inside existing → nested_inside", () => {
    const existing = [makeFolder("a", 0, 20)];
    const result = checkOverlap(makeLineRange(5, 10), existing);
    assert.strictEqual(result.kind, "nested_inside");
    if (result.kind === "nested_inside") {
      assert.strictEqual(result.parent.id, "a");
    }
  });

  test("proposed fully contains existing → contains", () => {
    const existing = [makeFolder("a", 5, 10)];
    const result = checkOverlap(makeLineRange(0, 20), existing);
    assert.strictEqual(result.kind, "contains");
    if (result.kind === "contains") {
      assert.strictEqual(result.children.length, 1);
      assert.strictEqual(result.children[0].id, "a");
    }
  });

  test("proposed fully contains multiple existing folders → contains all", () => {
    const existing = [makeFolder("a", 5, 10), makeFolder("b", 12, 18)];
    const result = checkOverlap(makeLineRange(0, 30), existing);
    assert.strictEqual(result.kind, "contains");
    if (result.kind === "contains") {
      assert.strictEqual(result.children.length, 2);
    }
  });

  test("conflicted folders are skipped in overlap check", () => {
    const conflicted = makeFolder("a", 10, 20);
    conflicted.status = "conflicted";
    const result = checkOverlap(makeLineRange(10, 20), [conflicted]);
    // identical range but conflicted — should be ok
    assert.strictEqual(result.kind, "ok");
  });

  test("drifted folders are skipped in overlap check", () => {
    const drifted = makeFolder("a", 10, 20);
    drifted.status = "drifted";
    const result = checkOverlap(makeLineRange(10, 20), [drifted]);
    assert.strictEqual(result.kind, "ok");
  });

  test("highlights are ignored in overlap check", () => {
    const highlight: Annotation = {
      id: "h1",
      filePath: "root/test.ts",
      range: makeLineRange(10, 20),
      kind: "highlight",
      note: "",
      color: "yellow",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = checkOverlap(makeLineRange(10, 20), [highlight]);
    assert.strictEqual(result.kind, "ok");
  });
});

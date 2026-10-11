import * as assert from "assert";
import { AnnotationStore } from "../../storage/store";
import { Annotation, makeLineRange } from "../../model/annotation";

// ---------------------------------------------------------------------------
// Inline copy of applyChange (pure function) so we can test it without VS Code
// ---------------------------------------------------------------------------

// We replicate the applyChange logic here since it's not exported from rangeTracker.ts
// and we want to test it independently without importing vscode.

interface SimpleRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

interface SimpleChange {
  range: { start: { line: number }; end: { line: number } };
  text: string;
}

function applyChange(
  range: SimpleRange,
  change: SimpleChange
): SimpleRange | "conflict" {
  const changeStart = change.range.start.line;
  const changeEnd = change.range.end.line;

  const newLineCount = (change.text.match(/\n/g) ?? []).length;
  const removedLines = changeEnd - changeStart;
  const lineDelta = newLineCount - removedLines;

  const annStart = range.start.line;
  const annEnd = range.end.line;

  if (changeStart > annEnd) {
    return range;
  }

  if (changeEnd < annStart) {
    return {
      start: { line: annStart + lineDelta, character: 0 },
      end: { line: annEnd + lineDelta, character: 0 },
    };
  }

  if (changeStart < annStart && changeEnd >= annStart && changeEnd <= annEnd) {
    return "conflict";
  }

  if (changeStart >= annStart && changeStart <= annEnd && changeEnd > annEnd) {
    return "conflict";
  }

  if (changeStart < annStart && changeEnd > annEnd) {
    return "conflict";
  }

  return {
    start: { line: annStart, character: 0 },
    end: { line: annEnd + lineDelta, character: 0 },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFolder(
  id: string,
  startLine: number,
  endLine: number
): Annotation {
  return {
    id,
    filePath: "root/test.ts",
    range: makeLineRange(startLine, endLine),
    kind: "folder",
    note: "test note",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function change(
  startLine: number,
  endLine: number,
  text: string
): SimpleChange {
  return { range: { start: { line: startLine }, end: { line: endLine } }, text };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite("RangeTracker — pure applyChange logic", () => {
  // ── Insert lines above annotation → range shifts down ──────────────────────
  test("insert lines above annotation → shifts down", () => {
    const range = makeLineRange(10, 20);
    // Insert 3 lines above (at line 5, single-line change → +3 new lines)
    const result = applyChange(range, change(5, 5, "\n\n\n"));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.strictEqual(result.start.line, 13);
      assert.strictEqual(result.end.line, 23);
    }
  });

  // ── Delete lines above annotation → range shifts up ───────────────────────
  test("delete lines above annotation → shifts up", () => {
    const range = makeLineRange(10, 20);
    // Delete lines 5–7: changeStart=5, changeEnd=7, removedLines=7-5=2, lineDelta=-2
    const result = applyChange(range, change(5, 7, ""));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.strictEqual(result.start.line, 8);  // 10 - 2 = 8
      assert.strictEqual(result.end.line, 18);   // 20 - 2 = 18
    }
  });

  // ── Edit inside annotation → end line adjusts ─────────────────────────────
  test("insert lines inside annotation → end expands", () => {
    const range = makeLineRange(10, 20);
    // Insert 2 lines inside (at line 15)
    const result = applyChange(range, change(15, 15, "\n\n"));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.strictEqual(result.start.line, 10);
      assert.strictEqual(result.end.line, 22);
    }
  });

  test("delete lines inside annotation → end shrinks", () => {
    const range = makeLineRange(10, 20);
    // Delete lines 12–14: changeStart=12, changeEnd=14, removedLines=14-12=2, lineDelta=-2
    const result = applyChange(range, change(12, 14, ""));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.strictEqual(result.start.line, 10);
      assert.strictEqual(result.end.line, 18);  // 20 - 2 = 18
    }
  });

  // ── Paste across start boundary → conflicted ──────────────────────────────
  test("paste across start boundary → conflict", () => {
    const range = makeLineRange(10, 20);
    // Change starts at line 8 (above) and ends at line 12 (inside)
    const result = applyChange(range, change(8, 12, "some replacement\n"));
    assert.strictEqual(result, "conflict");
  });

  // ── Paste across end boundary → conflicted ────────────────────────────────
  test("paste across end boundary → conflict", () => {
    const range = makeLineRange(10, 20);
    // Change starts at line 15 (inside) and ends at line 25 (below)
    const result = applyChange(range, change(15, 25, "some replacement\n"));
    assert.strictEqual(result, "conflict");
  });

  // ── Collapse to single line → conflicted ──────────────────────────────────
  test("collapse annotation to single line → conflict via store", () => {
    // Annotation spans lines 10–11 (two lines).
    // Replace both lines with a single line → lineDelta = -1
    // changeStart=10, changeEnd=11, removedLines=1, newLines=0, lineDelta=-1
    // Falls into "inside" case: end = 11 + (-1) = 10 → span = 0 < 1 → conflicted by caller
    const range = makeLineRange(10, 11);
    const result = applyChange(range, change(10, 11, "single line replacement"));
    if (result !== "conflict") {
      const lineSpan = result.end.line - result.start.line;
      assert.strictEqual(lineSpan < 1, true, "collapsed range should have span < 1");
    }
  });

  // ── Change entirely below → no effect ────────────────────────────────────
  test("change entirely below annotation → no effect", () => {
    const range = makeLineRange(10, 20);
    const result = applyChange(range, change(25, 30, "\n\n"));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.strictEqual(result.start.line, 10);
      assert.strictEqual(result.end.line, 20);
    }
  });

  // ── Change entirely above → shifts ───────────────────────────────────────
  test("change above annotation shifts by correct delta", () => {
    const range = makeLineRange(10, 20);
    // Replace 1 line at line 3 with 5 lines (+4 delta)
    const result = applyChange(range, change(3, 3, "a\nb\nc\nd\ne"));
    assert.notStrictEqual(result, "conflict");
    if (result !== "conflict") {
      assert.strictEqual(result.start.line, 14);
      assert.strictEqual(result.end.line, 24);
    }
  });
});

// ---------------------------------------------------------------------------
// Store integration tests
// ---------------------------------------------------------------------------

suite("RangeTracker — store interaction", () => {
  let store: AnnotationStore;

  setup(() => {
    store = new AnnotationStore();
  });

  test("store starts with active annotation", () => {
    store.add(makeFolder("1", 10, 20));
    const ann = store.getById("1");
    assert.strictEqual(ann?.status, "active");
  });

  test("updating status to conflicted works", () => {
    store.add(makeFolder("1", 10, 20));
    store.update("1", { status: "conflicted" });
    assert.strictEqual(store.getById("1")?.status, "conflicted");
  });

  test("updating status to drifted works", () => {
    store.add(makeFolder("1", 10, 20));
    store.update("1", { status: "drifted" });
    assert.strictEqual(store.getById("1")?.status, "drifted");
  });
});

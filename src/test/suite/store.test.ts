import * as assert from "assert";
import { AnnotationStore } from "../../storage/store";
import { Annotation, makeLineRange } from "../../model/annotation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnnotation(id: string, filePath: string): Annotation {
  return {
    id,
    filePath,
    range: makeLineRange(0, 5),
    kind: "folder",
    note: "test note",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite("AnnotationStore", () => {
  let store: AnnotationStore;

  setup(() => {
    store = new AnnotationStore();
    // No context — store starts empty, persistence is skipped
  });

  test("starts empty", () => {
    assert.deepStrictEqual(store.getTrackedFiles(), []);
  });

  test("add and retrieve by file", () => {
    const ann = makeAnnotation("1", "root/a.ts");
    store.add(ann);
    const list = store.getByFile("root/a.ts");
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, "1");
  });

  test("add and retrieve by ID", () => {
    const ann = makeAnnotation("abc", "root/a.ts");
    store.add(ann);
    const found = store.getById("abc");
    assert.ok(found);
    assert.strictEqual(found.note, "test note");
  });

  test("getById returns undefined for unknown ID", () => {
    assert.strictEqual(store.getById("nope"), undefined);
  });

  test("add replaces annotation with same ID", () => {
    const ann = makeAnnotation("1", "root/a.ts");
    store.add(ann);
    const updated = { ...ann, note: "updated" };
    store.add(updated);
    assert.strictEqual(store.getByFile("root/a.ts").length, 1);
    assert.strictEqual(store.getById("1")?.note, "updated");
  });

  test("update changes fields", () => {
    store.add(makeAnnotation("1", "root/a.ts"));
    store.update("1", { note: "changed", status: "conflicted" });
    const ann = store.getById("1");
    assert.strictEqual(ann?.note, "changed");
    assert.strictEqual(ann?.status, "conflicted");
  });

  test("update is no-op for unknown ID", () => {
    store.update("nope", { note: "x" }); // should not throw
    assert.strictEqual(store.getById("nope"), undefined);
  });

  test("remove deletes annotation", () => {
    store.add(makeAnnotation("1", "root/a.ts"));
    store.remove("1");
    assert.strictEqual(store.getById("1"), undefined);
    assert.strictEqual(store.getByFile("root/a.ts").length, 0);
  });

  test("remove cleans up empty file entry", () => {
    store.add(makeAnnotation("1", "root/a.ts"));
    store.remove("1");
    assert.strictEqual(store.getTrackedFiles().includes("root/a.ts"), false);
  });

  test("remove is no-op for unknown ID", () => {
    store.remove("nope"); // should not throw
  });

  test("removeFile deletes all annotations for that file", () => {
    store.add(makeAnnotation("1", "root/a.ts"));
    store.add(makeAnnotation("2", "root/a.ts"));
    store.add(makeAnnotation("3", "root/b.ts"));
    store.removeFile("root/a.ts");
    assert.strictEqual(store.getByFile("root/a.ts").length, 0);
    assert.strictEqual(store.getByFile("root/b.ts").length, 1);
  });

  test("clearAll empties the store", () => {
    store.add(makeAnnotation("1", "root/a.ts"));
    store.add(makeAnnotation("2", "root/b.ts"));
    store.clearAll();
    assert.deepStrictEqual(store.getTrackedFiles(), []);
  });

  test("getTrackedFiles returns all files with annotations", () => {
    store.add(makeAnnotation("1", "root/a.ts"));
    store.add(makeAnnotation("2", "root/b.ts"));
    const files = store.getTrackedFiles();
    assert.ok(files.includes("root/a.ts"));
    assert.ok(files.includes("root/b.ts"));
  });

  test("multiple annotations in same file", () => {
    store.add(makeAnnotation("1", "root/a.ts"));
    store.add(makeAnnotation("2", "root/a.ts"));
    assert.strictEqual(store.getByFile("root/a.ts").length, 2);
  });
});

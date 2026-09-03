/**
 * Pure ordering helpers for the Docs admin panel tree.
 *
 * The backend exposes `POST /api/docs/admin/documents/reorder/` and
 * `POST /api/docs/admin/categories/reorder/` — both take the FULL sibling
 * id list of one section in the desired order. These helpers find the
 * sibling list a node belongs to inside the loaded tree and produce the
 * swapped sequence for up/down moves. Keeping them pure (no React, no
 * network) makes the move logic unit-testable.
 */

/**
 * Find the documents list that contains `docId` anywhere in the category
 * tree (nested at any depth). Falls back to the uncategorized list.
 * @returns {{ siblings: Array, container: "category"|"uncategorized" } | null}
 */
export function findDocSiblings(tree, uncategorized, docId) {
  const walk = (nodes) => {
    for (const node of nodes || []) {
      const docs = node.documents || [];
      if (docs.some((doc) => doc.id === docId)) {
        return { siblings: docs, container: "category" };
      }
      const deeper = walk(node.children || []);
      if (deeper) return deeper;
    }
    return null;
  };
  const inCategories = walk(tree);
  if (inCategories) return inCategories;
  if ((uncategorized || []).some((doc) => doc.id === docId)) {
    return { siblings: uncategorized, container: "uncategorized" };
  }
  return null;
}

/**
 * Find the children array that contains `nodeId` (a category id).
 * Root-level categories live in the `tree` array itself.
 * @returns {Array | null} the sibling array (mutating it mutates the tree)
 */
export function findCategorySiblings(tree, nodeId) {
  if ((tree || []).some((node) => node.id === nodeId)) return tree;
  const walk = (nodes) => {
    for (const node of nodes || []) {
      const kids = node.children || [];
      if (kids.some((child) => child.id === nodeId)) return kids;
      const deeper = walk(kids);
      if (deeper) return deeper;
    }
    return null;
  };
  return walk(tree);
}

/**
 * Index of an id inside a list of objects — -1 when absent.
 */
export function indexOfId(list, id) {
  return (list || []).findIndex((item) => item.id === id);
}

/**
 * New array with entries at `from` and `to` swapped. Returns the SAME
 * reference when the swap is out of bounds (boundaries are no-ops).
 */
export function swapped(list, from, to) {
  if (!Array.isArray(list)) return list;
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const temp = next[from];
  next[from] = next[to];
  next[to] = temp;
  return next;
}

/**
 * Build the POST body for a one-step up/down move of a document.
 * @returns {{ ids: string[] } | null} null when the move is impossible
 */
export function documentMoveBody(tree, uncategorized, docId, direction) {
  const found = findDocSiblings(tree, uncategorized, docId);
  if (!found) return null;
  const index = indexOfId(found.siblings, docId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= found.siblings.length) return null;
  const ids = swapped(
    found.siblings.map((doc) => doc.id),
    index,
    target
  );
  return { ids };
}

/**
 * Build the POST body for a one-step up/down move of a category.
 * @returns {{ ids: string[] } | null} null when the move is impossible
 */
export function categoryMoveBody(tree, nodeId, direction) {
  const siblings = findCategorySiblings(tree, nodeId);
  if (!siblings) return null;
  const index = indexOfId(siblings, nodeId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= siblings.length) return null;
  const ids = swapped(
    siblings.map((node) => node.id),
    index,
    target
  );
  return { ids };
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag & drop helpers (drag-to-reorder + drag-between-folders).
//
// All of the DnD decision logic is pure so it can be unit-tested without
// React or a browser. The React side (useDocsDnd.js) only wires events to
// these functions and fires the existing admin APIs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Locate a category node object anywhere in the tree (any depth).
 * @returns {object | null}
 */
export function findCategoryNode(tree, nodeId) {
  for (const node of tree || []) {
    if (String(node.id) === String(nodeId)) return node;
    const deeper = findCategoryNode(node.children || [], nodeId);
    if (deeper) return deeper;
  }
  return null;
}

/**
 * True when `id` is `node` itself or lives anywhere inside node's subtree —
 * the client-side cycle guard for dropping a folder into its own child.
 */
export function subtreeContains(node, id) {
  if (!node || id == null) return false;
  if (String(node.id) === String(id)) return true;
  return (node.children || []).some((child) => subtreeContains(child, id));
}

/**
 * Same-list reorder: remove `draggedId` from the sibling id sequence and
 * re-insert it before/after `targetId`.
 * @returns {string[] | null} null when the target is absent
 */
export function reorderIds(siblings, draggedId, targetId, position) {
  if (!Array.isArray(siblings)) return null;
  const ids = siblings.map((item) => item.id).filter((id) => id !== draggedId);
  let at = ids.indexOf(targetId);
  if (at === -1) return null;
  if (position === "after") at += 1;
  ids.splice(at, 0, draggedId);
  return ids;
}

/**
 * Cross-list insert: place `draggedId` before/after `targetId` inside a
 * list that does NOT currently contain it (defensively filters anyway).
 * Missing target appends at the end.
 */
export function insertIds(targetSiblings, draggedId, targetId, position) {
  if (!Array.isArray(targetSiblings)) return null;
  const ids = targetSiblings.map((item) => item.id).filter((id) => id !== draggedId);
  let at = ids.indexOf(targetId);
  if (at === -1) at = ids.length;
  if (position === "after") at += 1;
  ids.splice(at, 0, draggedId);
  return ids;
}

/**
 * Next free order slot for a sibling group (max + 10, min 10).
 * Tolerates missing/legacy order values and empty lists.
 */
export function nextOrder(items) {
  let max = 0;
  (items || []).forEach((item) => {
    const value = Number(item?.order);
    if (Number.isFinite(value) && value > max) max = value;
  });
  return max + 10;
}

/**
 * Decide what happens when a dragged CATEGORY hovers a folder row.
 *
 *  - drop on itself, on its own subtree (cycle!) or on its current
 *    parent (no-op)   → { invalid: … }  → not droppable
 *  - drop on a SIBLING folder (same parent) → { type: "cat-reorder", … }
 *    → reorder among brothers at the hover position
 *  - drop on any other folder                    → { type: "cat-into-folder", … }
 *    → reparent + append at the end of the new sibling group
 *
 * `position` ("before" | "after") is refined by the caller from pointer
 * coordinates and merged into the returned plan.
 */
export function folderDropPlan(drag, node, tree) {
  if (!drag || !node || drag.kind !== "category") return { invalid: "unsupported" };
  if (String(drag.id) === String(node.id)) return { invalid: "self" };
  const draggedNode = findCategoryNode(tree, drag.id);
  if (!draggedNode) return { invalid: "missing" };
  if (subtreeContains(draggedNode, node.id)) return { invalid: "descendant" };
  if (String(node.parent_id ?? "") === String(drag.parentId ?? "")) {
    return { type: "cat-reorder", targetId: node.id, targetName: node.name };
  }
  if (String(node.id) === String(drag.parentId ?? "")) return { invalid: "parent-noop" };
  return { type: "cat-into-folder", targetId: node.id, targetName: node.name };
}

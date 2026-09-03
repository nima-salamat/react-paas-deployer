/**
 * Pure drag & drop plan computation for the Docs admin content tree.
 *
 * A "plan" describes what a drop will do BEFORE any API call happens:
 *
 *   { type, …targetIds, position?, label }   → a valid, droppable target
 *   null                                      → not droppable here (no-op)
 *
 * The plan is computed from the dragged item's data, the hovered
 * droppable's data and the current tree — all plain values, no React and
 * no network, so every branch is unit-testable in Node.
 *
 * Drag sources (data put on useDraggable rows):
 *   doc row      → { kind: "doc",  id, title, sectionId }   sectionId = category UUID | "general"
 *   folder row   → { kind: "category", id, name, parentId }
 *
 * Drop targets (data put on useDroppable rows):
 *   doc row      → { kind: "doc", id, title, sectionId }
 *   folder row   → { kind: "folder", node }        (the whole tree node)
 *   general zone → { kind: "general" }
 */

import { findCategoryNode, folderDropPlan } from "./docsOrder";

/** Section id used for uncategorized documents (no category row exists). */
export const GENERAL_ID = "general";

function sectionKey(value) {
  return value == null ? GENERAL_ID : String(value);
}

/**
 * "before" | "after" — which half of the hovered row the pointer is in.
 * Uses the droppable rect plus the pointer's live position (activator
 * start + drag delta). Falls back to "after" when geometry is missing
 * (safe default: appending below is the least surprising direction).
 */
export function dropPosition(event) {
  const rect =
    event?.over?.rect ||
    event?.collisions?.[0]?.data?.droppableContainer?.rect ||
    null;
  if (!rect || typeof rect.top !== "number" || !rect.height) return "after";
  const activator = event?.activatorEvent;
  const startY = typeof activator?.clientY === "number" ? activator.clientY : 0;
  const pointerY = startY + (event?.delta?.y || 0);
  return pointerY < rect.top + rect.height / 2 ? "before" : "after";
}

/**
 * Compare two plans for re-render avoidance during dragover spam
 * (dragover fires ~20×/s; identical plans must not re-render the tree).
 */
export function samePlan(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.type === b.type &&
    String(a.targetId ?? "") === String(b.targetId ?? "") &&
    String(a.folderId ?? "") === String(b.folderId ?? "") &&
    String(a.sectionId ?? "") === String(b.sectionId ?? "") &&
    a.position === b.position
  );
}

/**
 * The single decision table for the whole tree DnD.
 *
 * @param {object} active   dragged item data (see header)
 * @param {object} over     hovered droppable data (see header)
 * @param {object} ctx      { categories, uncategorized, position }
 * @returns {object|null}   the plan, or null when the drop is a no-op
 */
export function computeDropPlan(active, over, ctx) {
  if (!active || !over) return null;
  const { categories, uncategorized, position = "after" } = ctx || {};
  const from = sectionKey(active.sectionId);

  // ── Articles being dragged ────────────────────────────────────────────
  if (active.kind === "doc") {
    // Onto another article row: reorder (same folder) or move + insert
    // (different folder, incl. General). Position from pointer half.
    if (over.kind === "doc") {
      if (String(over.id) === String(active.id)) return null;
      const target = sectionKey(over.sectionId);
      const siblings =
        target === GENERAL_ID
          ? uncategorized
          : findCategoryNode(categories, target)?.documents;
      if (!siblings || !siblings.some((d) => String(d.id) === String(over.id))) {
        return null;
      }
      const sameSection = target === from;
      return {
        type: "doc-position",
        targetId: over.id,
        sectionId: target,
        position,
        sameSection,
        label:
          `Reorder “${active.title || "article"}” ` +
          `${position === "before" ? "before" : "after"} “${over.title || "article"}”` +
          (sameSection ? "" : " (moves folder)"),
      };
    }

    // Onto a folder row: file the article into that folder (appended to
    // the end of that section — the backend repositions on category move).
    if (over.kind === "folder" && over.node) {
      const folderId = String(over.node.id);
      if (folderId === from) return null; // already lives in this folder
      return {
        type: "doc-into-folder",
        folderId: over.node.id,
        folderName: over.node.name,
        label: `Move “${active.title || "article"}” into “${over.node.name}”`,
      };
    }

    // Onto the General zone: take the article out of its folder.
    if (over.kind === "general") {
      if (from === GENERAL_ID) return null; // already uncategorized
      return {
        type: "doc-to-general",
        label: `Move “${active.title || "article"}” out to General (no category)`,
      };
    }
    return null;
  }

  // ── Folders (sections) being dragged ──────────────────────────────────
  if (active.kind === "category") {
    // Onto a folder row: sibling → reorder, other folder → reparent.
    if (over.kind === "folder" && over.node) {
      const base = folderDropPlan(active, over.node, categories);
      if (!base || base.invalid) return null;
      if (base.type === "cat-reorder") {
        return {
          ...base,
          position,
          label:
            `Reorder section “${active.name}” ` +
            `${position === "before" ? "before" : "after"} “${base.targetName}”`,
        };
      }
      return {
        ...base,
        label: `Move section “${active.name}” into “${base.targetName}”`,
      };
    }

    // Onto the General zone: move the section up to root level.
    if (over.kind === "general") {
      if (active.parentId == null) return null; // already a root section
      return {
        type: "cat-to-root",
        label: `Move section “${active.name}” to root`,
      };
    }

    // Dropping a folder on an article row means nothing.
    return null;
  }

  return null;
}

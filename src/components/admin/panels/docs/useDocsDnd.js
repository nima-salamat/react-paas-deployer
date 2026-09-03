import { useCallback, useRef, useState } from "react";
import {
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import apiRequest from "../../../customHooks/apiRequest";
import { hostBase } from "../../adminUtils";
import { GENERAL_ID, computeDropPlan, dropPosition, samePlan } from "./docsDndPlan";
import {
  findCategoryNode,
  findCategorySiblings,
  insertIds,
  nextOrder,
  reorderIds,
} from "./docsOrder";

const base = `${hostBase()}/api/docs`;

// The tree viewport scrolls mid-drag; droppable rects must follow the rows
// or the highlights/drops would use stale geometry.
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

/**
 * useDocsDnd — drag & drop state machine for the Docs admin content tree.
 *
 * Wraps @dnd-kit's DndContext with the panel's data + the existing admin
 * APIs (Task 8's ordering endpoints), so dragging a row is all it takes
 * to reorder articles, file them into folders, take them out, or move
 * whole sections around:
 *
 *   drop article on article  → reorder inside that folder (or move +
 *                              insert when the folders differ)
 *   drop article on folder   → move into that folder (appended at end)
 *   drop article on General  → move out to "no category"
 *   drop folder on folder    → sibling: reorder · other: reparent into it
 *   drop folder on General   → move the section up to root
 *
 * Every branch reuses the battle-tested backend behaviour: the reorder
 * endpoints renumber the whole sibling list (10, 20, 30 …) and PATCHing
 * a document/category repositions it at the end of the new section.
 * Nothing here needs a new backend route.
 *
 * The hook is intentionally thin: all decision logic lives in the pure
 * modules docsDndPlan.js / docsOrder.js so it stays unit-testable.
 */
export function useDocsDnd({
  categories,
  uncategorized,
  reload,
  notifyError,
  notifySuccess,
  onCategoryChanged,
  onRevealFolder,
}) {
  const [activeDrag, setActiveDrag] = useState(null); // dragged item data
  const [dropPlan, setDropPlan] = useState(null); // current hover plan
  const busyRef = useRef(false); // one move at a time

  const sensors = useSensors(
    // 6px of slack keeps plain clicks (select / expand / buttons) working
    // while still starting drags from the № handle without a dead zone.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Pointer-first collision (predictable for thin rows), falling back to
  // rect intersection when the pointer slips between rows mid-move.
  const collisionDetection = useCallback(
    (args) => {
      const within = pointerWithin(args);
      if (within.length) return within;
      return rectIntersection(args);
    },
    []
  );

  // The tree viewport scrolls; droppable rects must follow the rows.
  const measuring = MEASURING;

  const onDragStart = useCallback((event) => {
    setActiveDrag(event.active?.data?.current || null);
    setDropPlan(null);
  }, []);

  const onDragOver = useCallback(
    (event) => {
      const active = event.active?.data?.current;
      const over = event.over?.data?.current;
      if (!active || !over) {
        setDropPlan((prev) => (prev == null ? prev : null));
        return;
      }
      const plan = computeDropPlan(active, over, {
        categories,
        uncategorized,
        position: dropPosition(event),
      });
      setDropPlan((prev) => (samePlan(prev, plan) ? prev : plan));
    },
    [categories, uncategorized]
  );

  const onDragCancel = useCallback(() => {
    setActiveDrag(null);
    setDropPlan(null);
  }, []);

  const sectionName = useCallback(
    (sectionId) => {
      if (sectionId === GENERAL_ID) return "General (no category)";
      return findCategoryNode(categories, sectionId)?.name || "General (no category)";
    },
    [categories]
  );

  const executePlan = useCallback(
    async (plan, active) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        if (plan.type === "doc-position") {
          const siblings =
            plan.sectionId === GENERAL_ID
              ? uncategorized
              : findCategoryNode(categories, plan.sectionId)?.documents;
          if (!siblings || !siblings.some((d) => String(d.id) === String(plan.targetId))) {
            return;
          }
          const ids = plan.sameSection
            ? reorderIds(siblings, active.id, plan.targetId, plan.position)
            : insertIds(siblings, active.id, plan.targetId, plan.position);
          if (!ids) return;
          // Nothing changed (e.g. dropped one slot away in same section)?
          if (ids.join("|") === siblings.map((s) => s.id).join("|")) return;
          if (!plan.sameSection) {
            // 1) re-file the article (backend appends it to the end of the
            //    new section), 2) rewrite the exact target sequence.
            await apiRequest({
              url: `${base}/admin/documents/${active.id}/`,
              method: "PATCH",
              data: {
                category: plan.sectionId === GENERAL_ID ? null : plan.sectionId,
              },
            });
          }
          await apiRequest({
            url: `${base}/admin/documents/reorder/`,
            method: "POST",
            data: { ids },
          });
          await reload();
          if (!plan.sameSection) {
            onCategoryChanged?.(
              active.id,
              plan.sectionId === GENERAL_ID ? null : plan.sectionId
            );
            if (plan.sectionId !== GENERAL_ID) onRevealFolder?.(plan.sectionId);
          }
          const at = ids.indexOf(active.id) + 1;
          notifySuccess(
            plan.sameSection
              ? `“${active.title || "Article"}” moved to position ${at}.`
              : `“${active.title || "Article"}” moved into “${sectionName(plan.sectionId)}” at position ${at}.`
          );
          return;
        }

        if (plan.type === "doc-into-folder") {
          await apiRequest({
            url: `${base}/admin/documents/${active.id}/`,
            method: "PATCH",
            data: { category: plan.folderId },
          });
          await reload();
          onCategoryChanged?.(active.id, plan.folderId);
          onRevealFolder?.(plan.folderId);
          notifySuccess(
            `“${active.title || "Article"}” moved into “${plan.folderName}”.`
          );
          return;
        }

        if (plan.type === "doc-to-general") {
          await apiRequest({
            url: `${base}/admin/documents/${active.id}/`,
            method: "PATCH",
            data: { category: null },
          });
          await reload();
          onCategoryChanged?.(active.id, null);
          notifySuccess(
            `“${active.title || "Article"}” moved out to General (no category).`
          );
          return;
        }

        if (plan.type === "cat-reorder") {
          const siblings = findCategorySiblings(categories, active.id);
          const ids = siblings
            ? reorderIds(siblings, active.id, plan.targetId, plan.position)
            : null;
          if (!ids || ids.join("|") === siblings.map((s) => s.id).join("|")) {
            return;
          }
          await apiRequest({
            url: `${base}/admin/categories/reorder/`,
            method: "POST",
            data: { ids },
          });
          await reload();
          notifySuccess(`Section “${active.name}” reordered.`);
          return;
        }

        if (plan.type === "cat-into-folder") {
          const target = findCategoryNode(categories, plan.targetId);
          await apiRequest({
            url: `${base}/admin/categories/${active.id}/`,
            method: "PATCH",
            data: { parent: plan.targetId, order: nextOrder(target?.children) },
          });
          await reload();
          onRevealFolder?.(plan.targetId);
          notifySuccess(`Section “${active.name}” moved into “${plan.targetName}”.`);
          return;
        }

        if (plan.type === "cat-to-root") {
          await apiRequest({
            url: `${base}/admin/categories/${active.id}/`,
            method: "PATCH",
            data: { parent: null, order: nextOrder(categories) },
          });
          await reload();
          notifySuccess(`Section “${active.name}” moved to root.`);
        }
      } catch (e) {
        notifyError(
          e?.response?.data?.detail ||
            e?.response?.data?.parent?.[0] ||
            "The drag move could not be saved."
        );
        // Re-sync the UI with whatever the server actually kept.
        try {
          await reload();
        } catch {
          /* keep local state — the next reload will recover */
        }
      } finally {
        busyRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, uncategorized, reload, notifyError, notifySuccess, onCategoryChanged, onRevealFolder, sectionName]
  );

  const onDragEnd = useCallback(
    (event) => {
      const active = event.active?.data?.current;
      const over = event.over?.data?.current;
      setActiveDrag(null);
      setDropPlan(null);
      if (!active || !over) return;
      const plan = computeDropPlan(active, over, {
        categories,
        uncategorized,
        position: dropPosition(event),
      });
      if (!plan) return;
      executePlan(plan, active);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [executePlan, categories, uncategorized]
  );

  return {
    sensors,
    collisionDetection,
    measuring,
    activeDrag,
    dropPlan,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel,
  };
}

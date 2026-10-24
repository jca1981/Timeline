// **** Undo/Redo historik (M10): snapshot-baseret command stack ****
import type { TimelineDoc } from '../model/doc';

const MAX_HISTORY = 50;

interface HistoryStack {
  past: TimelineDoc[];
  future: TimelineDoc[];
}

let stack: HistoryStack = { past: [], future: [] };

/** Push a snapshot BEFORE a mutation (captures the "before" state). */
export function pushSnapshot(doc: TimelineDoc): void {
  stack.past.push(JSON.parse(JSON.stringify(doc)));
  if (stack.past.length > MAX_HISTORY) stack.past.shift();
  stack.future = []; // new action clears redo
}

/** Undo: returns previous doc or null if nothing to undo. */
export function undo(currentDoc: TimelineDoc): TimelineDoc | null {
  const prev = stack.past.pop();
  if (!prev) return null;
  stack.future.push(JSON.parse(JSON.stringify(currentDoc)));
  return prev;
}

/** Redo: returns next doc or null if nothing to redo. */
export function redo(currentDoc: TimelineDoc): TimelineDoc | null {
  const next = stack.future.pop();
  if (!next) return null;
  stack.past.push(JSON.parse(JSON.stringify(currentDoc)));
  return next;
}

/** Can undo? */
export function canUndo(): boolean {
  return stack.past.length > 0;
}

/** Can redo? */
export function canRedo(): boolean {
  return stack.future.length > 0;
}

/** Clear history (e.g. after doc switch). */
export function clearHistory(): void {
  stack = { past: [], future: [] };
}

/** Get history depth info (for UI). */
export function historyInfo(): { undoCount: number; redoCount: number } {
  return { undoCount: stack.past.length, redoCount: stack.future.length };
}

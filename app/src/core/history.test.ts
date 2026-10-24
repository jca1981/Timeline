import { describe, it, expect, beforeEach } from 'vitest';
import { pushSnapshot, undo, redo, canUndo, canRedo, clearHistory, historyInfo } from './history';
import { emptyDoc, type TimelineDoc } from '../model/doc';

function docWith(n: number): TimelineDoc {
  const d = emptyDoc();
  for (let i = 0; i < n; i++) {
    d.items.push({ id: `item-${i}`, typeId: d.itemTypes[0].id, label: `Item ${i}`, span: { start: { y: 2000 + i, precision: 'year' } } });
  }
  return d;
}

describe('history (M10)', () => {
  beforeEach(() => clearHistory());

  it('undo returns null when history is empty', () => {
    expect(undo(docWith(1))).toBeNull();
    expect(canUndo()).toBe(false);
  });

  it('pushSnapshot + undo returns previous state', () => {
    const before = docWith(1);
    const after = docWith(2);
    pushSnapshot(before);
    const result = undo(after);
    expect(result).not.toBeNull();
    expect(result!.items.length).toBe(1);
  });

  it('redo returns the forward state after undo', () => {
    const before = docWith(1);
    const after = docWith(2);
    pushSnapshot(before);
    undo(after); // go back → before
    const fwd = redo(before); // redo → after
    expect(fwd).not.toBeNull();
    expect(fwd!.items.length).toBe(2);
  });

  it('push clears redo stack', () => {
    const a = docWith(1);
    const b = docWith(2);
    const c = docWith(3);
    pushSnapshot(a);
    undo(b); // redo has b
    pushSnapshot(b); // new action → clears redo
    expect(canRedo()).toBe(false);
    expect(redo(c)).toBeNull();
  });

  it('respects MAX_HISTORY (50)', () => {
    for (let i = 0; i < 60; i++) pushSnapshot(docWith(i));
    const info = historyInfo();
    expect(info.undoCount).toBe(50);
  });

  it('clearHistory resets both stacks', () => {
    pushSnapshot(docWith(1));
    undo(docWith(2));
    clearHistory();
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
  });
});

// **** Parent/child-hierarki: range-advarsler, træ-struktur (M5) ****
import type { Item, TimelineDoc } from '../model/doc';
import { toJD } from './jdn';

export interface RangeWarning {
  itemId: string;
  parentId: string;
  message: string; // dansk advarselstekst
}

/** Hjælp: JDN for start/end af en items span. Null hvis ukendt. */
function spanJD(item: Item): { a: number | null; b: number | null } {
  const a = item.span.start ? toJD(item.span.start) : null;
  const b = item.span.end ? toJD(item.span.end)
    : item.span.ongoing ? null // ongoing = uendelig → ingen violation
    : a; // point-in-time = start
  return { a, b };
}

/** Tjek om et child's tidsramme ligger uden for parent's. Returnér advarsler. */
export function checkParentRanges(doc: TimelineDoc): RangeWarning[] {
  const warnings: RangeWarning[] = [];
  const byId = new Map(doc.items.map((it) => [it.id, it]));

  for (const child of doc.items) {
    if (!child.parentId) continue;
    const parent = byId.get(child.parentId);
    if (!parent) {
      warnings.push({ itemId: child.id, parentId: child.parentId, message: 'Forelder findes ikke (slettet?)' });
      continue;
    }

    const p = spanJD(parent);
    const c = spanJD(child);

    // Kun advar hvis begge har evaluable datoer
    if (p.a === null || p.b === null) continue; // parent uden dato = ingen begrænsning
    if (c.a === null) continue; // child uden start = kan ikke evaluere

    const beforeParent = c.a < p.a;
    const afterParent = c.b !== null && c.b > p.b;

    if (beforeParent && afterParent) {
      warnings.push({ itemId: child.id, parentId: parent.id, message: 'Ligger helt uden for forælder' });
    } else if (beforeParent) {
      warnings.push({ itemId: child.id, parentId: parent.id, message: 'Starter før forælder' });
    } else if (afterParent) {
      warnings.push({ itemId: child.id, parentId: parent.id, message: 'Slutter efter forælder' });
    }
  }

  return warnings;
}

/** Byg en træ-struktur: returnér array af top-level items med children rekursivt. */
export interface TreeNode {
  item: Item;
  children: TreeNode[];
  depth: number;
}

export function buildTree(items: Item[]): TreeNode[] {
  const byId = new Map(items.map((it) => [it.id, { item: it, children: [] as TreeNode[], depth: 0 }]));
  const roots: TreeNode[] = [];

  for (const node of byId.values()) {
    const parent = node.item.parentId ? byId.get(node.item.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // beregn dybde
  function setDepth(nodes: TreeNode[], d: number) {
    for (const n of nodes) {
      n.depth = d;
      setDepth(n.children, d + 1);
    }
  }
  setDepth(roots, 0);

  // sortér children kronologisk
  function sortChildren(nodes: TreeNode[]) {
    for (const n of nodes) {
      n.children.sort((a, b) => (a.item.span.start?.y ?? 9999) - (b.item.span.start?.y ?? 9999));
      sortChildren(n.children);
    }
  }
  sortChildren(roots);

  return roots;
}

/** Fladt output fra træ (til spreadsheet: rækkefølge + depth). */
export function flattenTree(roots: TreeNode[]): Array<TreeNode> {
  const out: TreeNode[] = [];
  function walk(nodes: TreeNode[]) {
    for (const n of nodes) {
      out.push(n);
      walk(n.children);
    }
  }
  walk(roots);
  return out;
}

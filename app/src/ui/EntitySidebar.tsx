// **** Entity-sidebar (M12): hurtigfiltrering via typer, forældre, tags ****
import { useMemo } from 'react';
import { useApp } from '../store';
import { buildTree } from '../core/hierarchy';

export function EntitySidebar() {
  const doc = useApp((s) => s.doc);
  const activeFilter = useApp((s) => s.activeFilter);
  const setFilter = useApp((s) => s.setFilter);
  const select = useApp((s) => s.select);
  const jumpTo = useApp((s) => s.jumpTo);
  const collapsedIds = useApp((s) => s.collapsedIds);
  const toggleCollapse = useApp((s) => s.toggleCollapse);

  // Build hierarchy-aware list
  const tree = useMemo(() => buildTree(doc.items), [doc.items]);

  // Group top-level items by type
  const grouped = useMemo(() => {
    const byType: Record<string, typeof tree> = {};
    for (const node of tree) {
      const t = doc.itemTypes.find((t) => t.id === node.item.typeId);
      const key = t?.name ?? 'Uden type';
      (byType[key] ??= []).push(node);
    }
    return byType;
  }, [tree, doc.itemTypes]);

  // Collect all tags used across items
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const it of doc.items) it.tags?.forEach((t) => tags.add(t));
    return [...tags].sort();
  }, [doc.items]);

  const isEntityTypeFiltered = activeFilter?.types && activeFilter.types.length === 1;
  const isTagFiltered = activeFilter?.tags && activeFilter.tags.length === 1;

  function filterByType(typeName: string) {
    const type = doc.itemTypes.find((t) => t.name === typeName);
    if (!type) return;
    setFilter({ ...(activeFilter ?? { match: 'all' as const }), types: [type.id] });
  }

  function filterByTag(tag: string) {
    setFilter({ ...(activeFilter ?? { match: 'all' as const }), tags: [tag] });
  }

  function filterByParent(parentId: string) {
    setFilter({ ...(activeFilter ?? { match: 'all' as const }), parentId });
  }

  function clearFilter() {
    setFilter(null);
  }

  return (
    <aside className="entity-sidebar">
      <div className="entity-header">
        <strong>Entity-liste</strong>
        {(activeFilter) && <button className="btn-link" onClick={clearFilter}>Ryd filter ✕</button>}
      </div>

      {Object.entries(grouped).map(([typeName, nodes]) => {
        const collapsed = collapsedIds.has('grp:' + typeName);
        return (
          <div key={typeName} className="entity-group">
            <button
              className="entity-group-toggle"
              onClick={() => toggleCollapse('grp:' + typeName)}
            >
              {collapsed ? '▶' : '▼'} {typeName} ({nodes.length})
            </button>
            <button className="entity-filter-btn" onClick={() => filterByType(typeName)} title="Filtrér til kun denne type">⊙</button>
            {!collapsed && (
              <ul className="entity-list">
                {nodes.slice(0, 30).map((node) => {
                  const hasChildren = node.children.length > 0;
                  const childCount = countDescendants(node);
                  return (
                    <li key={node.item.id}>
                      <span
                        className={`entity-name ${isEntityTypeFiltered ? 'filtered' : ''}`}
                        onClick={() => { select(node.item.id); jumpTo(node.item.id); }}
                        title={childCount > 0 ? `${childCount} underliggende poster – højreklik for subtree-filter` : undefined}
                        onContextMenu={(e) => { e.preventDefault(); if (hasChildren) filterByParent(node.item.id); }}
                      >
                        {node.item.label}
                        {hasChildren && <span className="entity-count"> ({childCount})</span>}
                      </span>
                      {hasChildren && !collapsedIds.has(node.item.id) && (
                        <ul className="entity-sublist">
                          {node.children.slice(0, 15).map((child) => (
                            <li key={child.item.id}>
                              <span
                                className="entity-name small"
                                onClick={() => { select(child.item.id); jumpTo(child.item.id); }}
                              >
                                {child.item.label}
                              </span>
                            </li>
                          ))}
                          {node.children.length > 15 && <li className="entity-more">…+{node.children.length - 15} mere</li>}
                        </ul>
                      )}
                    </li>
                  );
                })}
                {nodes.length > 30 && <li className="entity-more">…+{nodes.length - 30} flere (brug filter)</li>}
              </ul>
            )}
          </div>
        );
      })}

      {allTags.length > 0 && (
        <div className="entity-group">
          <button className="entity-group-toggle" onClick={() => toggleCollapse('grp:tags')}>
            {collapsedIds.has('grp:tags') ? '▶' : '▼'} Tags ({allTags.length})
          </button>
          {!collapsedIds.has('grp:tags') && (
            <div className="entity-tags">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={`tag-chip ${isTagFiltered && activeFilter?.tags?.[0] === tag ? 'active' : ''}`}
                  onClick={() => filterByTag(tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function countDescendants(node: { children: { item: unknown; children: unknown[] }[] }): number {
  let n = 0;
  for (const c of node.children) {
    n += 1 + countDescendants(c as typeof node);
  }
  return n;
}

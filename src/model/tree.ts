import type { Collection, CollectionNode } from "./types";

export function buildCollectionTree(collections: Collection[]): CollectionNode[] {
  const byId = new Map<number, CollectionNode>();
  for (const c of collections) {
    byId.set(c.id, { ...c, children: [] });
  }

  const roots: CollectionNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId != null ? byId.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (nodes: CollectionNode[]): void => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);

  return roots;
}

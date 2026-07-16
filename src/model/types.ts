export interface Creator {
  firstName: string | null;
  lastName: string;
}

export interface Annotation {
  key: string;
  text: string | null;
  comment: string | null;
  color: string;
  pageLabel: string | null;
  sortIndex: string;
}

export interface ZoteroItem {
  key: string;
  title: string;
  abstract: string | null;
  year: string | null;
  dateAdded: string;
  creators: Creator[];
  tags: string[];
  annotations: Annotation[];
  collectionIds: number[];
  relatedKeys: string[];
}

export interface Collection {
  id: number;
  name: string;
  parentId: number | null;
}

export interface CollectionNode extends Collection {
  children: CollectionNode[];
}

export interface ZoteroLibrary {
  collections: Collection[];
  items: ZoteroItem[];
}

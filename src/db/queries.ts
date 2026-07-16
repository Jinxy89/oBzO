import type { Database } from "sql.js";
import type { SnapshotHandle } from "./snapshot";
import type { Annotation, Collection, Creator, ZoteroItem, ZoteroLibrary } from "../model/types";

// Identify attachments/annotations structurally via their tables rather than by
// hardcoded itemTypeID (type ids vary per Zotero install).
export function rows(db: Database, sql: string): Record<string, unknown>[] {
  const res = db.exec(sql);
  if (res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => (obj[col] = row[i]));
    return obj;
  });
}

export function readLibrary(handle: SnapshotHandle): ZoteroLibrary {
  const db = handle.db;

  const collections: Collection[] = rows(
    db,
    `SELECT collectionID AS id, collectionName AS name, parentCollectionID AS parentId FROM collections`
  ).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    parentId: r.parentId == null ? null : Number(r.parentId),
  }));

  const attachmentIds = new Set(rows(db, `SELECT itemID FROM itemAttachments`).map((r) => Number(r.itemID)));
  const annotationItemIds = new Set(rows(db, `SELECT itemID FROM itemAnnotations`).map((r) => Number(r.itemID)));

  const fieldId = (name: string): number => {
    const r = rows(db, `SELECT fieldID FROM fields WHERE fieldName = '${name}' LIMIT 1`);
    return r.length ? Number(r[0].fieldID) : -1;
  };
  const titleField = fieldId("title");
  const abstractField = fieldId("abstractNote");
  const dateField = fieldId("date");

  const itemRows = rows(db, `SELECT itemID, key, dateAdded FROM items`).filter(
    (r) => !attachmentIds.has(Number(r.itemID)) && !annotationItemIds.has(Number(r.itemID))
  );

  const items: ZoteroItem[] = itemRows.map((r) => {
    const itemID = Number(r.itemID);
    return {
      key: String(r.key),
      title: dataValue(db, itemID, titleField) ?? "(untitled)",
      abstract: dataValue(db, itemID, abstractField),
      year: extractYear(dataValue(db, itemID, dateField)),
      dateAdded: String(r.dateAdded),
      creators: creatorsFor(db, itemID),
      tags: tagsFor(db, itemID),
      annotations: annotationsForPaper(db, itemID),
      collectionIds: collectionIdsFor(db, itemID),
      relatedKeys: relatedKeysFor(db, itemID),
    };
  });

  return { collections, items };
}

function dataValue(db: Database, itemID: number, fieldID: number): string | null {
  if (fieldID < 0) return null;
  const r = rows(
    db,
    `SELECT v.value AS value FROM itemData d JOIN itemDataValues v ON v.valueID = d.valueID
     WHERE d.itemID = ${itemID} AND d.fieldID = ${fieldID} LIMIT 1`
  );
  return r.length ? String(r[0].value) : null;
}

function extractYear(date: string | null): string | null {
  if (!date) return null;
  const m = date.match(/\d{4}/);
  return m ? m[0] : null;
}

function creatorsFor(db: Database, itemID: number): Creator[] {
  return rows(
    db,
    `SELECT c.firstName AS firstName, c.lastName AS lastName
     FROM itemCreators ic JOIN creators c ON c.creatorID = ic.creatorID
     WHERE ic.itemID = ${itemID} ORDER BY ic.orderIndex`
  ).map((r) => ({
    firstName: r.firstName == null ? null : String(r.firstName),
    lastName: String(r.lastName ?? ""),
  }));
}

function tagsFor(db: Database, itemID: number): string[] {
  return rows(
    db,
    `SELECT t.name AS name FROM itemTags it JOIN tags t ON t.tagID = it.tagID WHERE it.itemID = ${itemID}`
  ).map((r) => String(r.name));
}

function collectionIdsFor(db: Database, itemID: number): number[] {
  return rows(db, `SELECT collectionID FROM collectionItems WHERE itemID = ${itemID}`).map((r) =>
    Number(r.collectionID)
  );
}

function relatedKeysFor(db: Database, itemID: number): string[] {
  return rows(db, `SELECT object FROM itemRelations WHERE itemID = ${itemID}`)
    .map((r) => String(r.object).split("/").pop() ?? "")
    .filter((k) => k.length > 0);
}

function annotationsForPaper(db: Database, paperItemID: number): Annotation[] {
  return rows(
    db,
    `SELECT ann.text AS text, ann.comment AS comment, ann.color AS color,
            ann.pageLabel AS pageLabel, ann.sortIndex AS sortIndex, i.key AS key
     FROM itemAnnotations ann
     JOIN itemAttachments att ON att.itemID = ann.parentItemID
     JOIN items i ON i.itemID = ann.itemID
     WHERE att.parentItemID = ${paperItemID}
     ORDER BY ann.sortIndex`
  ).map((r) => ({
    key: String(r.key),
    text: r.text == null ? null : String(r.text),
    comment: r.comment == null ? null : String(r.comment),
    color: String(r.color ?? ""),
    pageLabel: r.pageLabel == null ? null : String(r.pageLabel),
    sortIndex: String(r.sortIndex ?? ""),
  }));
}

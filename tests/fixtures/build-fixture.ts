import initSqlJs from "sql.js";
import { writeFileSync } from "node:fs";

export async function buildFixtureDb(path: string): Promise<void> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE collections (collectionID INTEGER PRIMARY KEY, collectionName TEXT, parentCollectionID INTEGER, key TEXT);
    CREATE TABLE collectionItems (collectionID INTEGER, itemID INTEGER, orderIndex INTEGER);
    CREATE TABLE items (itemID INTEGER PRIMARY KEY, itemTypeID INTEGER, key TEXT, dateAdded TEXT);
    CREATE TABLE fields (fieldID INTEGER PRIMARY KEY, fieldName TEXT);
    CREATE TABLE itemDataValues (valueID INTEGER PRIMARY KEY, value TEXT);
    CREATE TABLE itemData (itemID INTEGER, fieldID INTEGER, valueID INTEGER);
    CREATE TABLE itemAnnotations (itemID INTEGER PRIMARY KEY, parentItemID INTEGER, type INTEGER, text TEXT, comment TEXT, color TEXT, pageLabel TEXT, sortIndex TEXT);
    CREATE TABLE itemAttachments (itemID INTEGER PRIMARY KEY, parentItemID INTEGER, contentType TEXT, path TEXT);
    CREATE TABLE creators (creatorID INTEGER PRIMARY KEY, firstName TEXT, lastName TEXT, fieldMode INTEGER);
    CREATE TABLE creatorTypes (creatorTypeID INTEGER PRIMARY KEY, creatorType TEXT);
    CREATE TABLE itemCreators (itemID INTEGER, creatorID INTEGER, creatorTypeID INTEGER, orderIndex INTEGER);
    CREATE TABLE tags (tagID INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE itemTags (itemID INTEGER, tagID INTEGER, type INTEGER);
    CREATE TABLE itemRelations (itemID INTEGER, predicateID INTEGER, object TEXT);
  `);

  db.run(`INSERT INTO fields (fieldID, fieldName) VALUES (1,'title'),(2,'abstractNote'),(3,'date');`);
  db.run(`INSERT INTO creatorTypes (creatorTypeID, creatorType) VALUES (1,'author');`);

  // paper item 10 (key ABCD1234), attachment item 11
  db.run(`INSERT INTO items (itemID, itemTypeID, key, dateAdded) VALUES (10, 4, 'ABCD1234', '2026-07-02 00:00:00');`);
  db.run(`INSERT INTO items (itemID, itemTypeID, key, dateAdded) VALUES (11, 14, 'ATTACH001', '2026-07-02 00:00:00');`);
  db.run(`INSERT INTO itemAttachments (itemID, parentItemID, contentType, path) VALUES (11, 10, 'application/pdf', 'storage:paper.pdf');`);

  db.run(`INSERT INTO itemDataValues (valueID, value) VALUES
    (100,'Attention Is All You Need'),(101,'We propose the Transformer, a model architecture...'),(102,'2017');`);
  db.run(`INSERT INTO itemData (itemID, fieldID, valueID) VALUES (10,1,100),(10,2,101),(10,3,102);`);

  db.run(`INSERT INTO creators (creatorID, firstName, lastName, fieldMode) VALUES (200,'Ashish','Vaswani',0),(201,'Noam','Shazeer',0);`);
  db.run(`INSERT INTO itemCreators (itemID, creatorID, creatorTypeID, orderIndex) VALUES (10,200,1,0),(10,201,1,1);`);

  db.run(`INSERT INTO tags (tagID, name) VALUES (300,'theme/attention'),(301,'nlp');`);
  db.run(`INSERT INTO itemTags (itemID, tagID, type) VALUES (10,300,0),(10,301,0);`);

  // annotations are child items 12, 13, & 14; their keys become highlight block ids later
  db.run(`INSERT INTO items (itemID, itemTypeID, key, dateAdded) VALUES (12, 15, 'ANNOAB12', '2026-07-03 00:00:00'),(13, 15, 'ANNOCD34', '2026-07-03 00:00:00'),(14, 15, 'ANNOEF56', '2026-07-03 00:00:00');`);
  db.run(`INSERT INTO itemAnnotations (itemID, parentItemID, type, text, comment, color, pageLabel, sortIndex) VALUES
    (12, 11, 1, 'The Transformer allows for more parallelization', 'compare to [[recurrence]]', '#ffd400', '3', '00003|000100|00010'),
    (13, 11, 1, 'self-attention', 'key mechanism', '#a28ae5', '2', '00002|000050|00005'),
    (14, 11, 1, 'multi-head attention', 'enables parallel computation', '#ff9500', '4', '00004|000075|00015');`);

  const data = db.export();
  writeFileSync(path, Buffer.from(data));
  db.close();
}

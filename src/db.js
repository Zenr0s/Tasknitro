const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function createDatabase(filename = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'collection.sqlite')) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      namespace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      set_code TEXT NOT NULL,
      set_name TEXT NOT NULL,
      collector_number TEXT NOT NULL,
      finish TEXT NOT NULL CHECK (finish IN ('nonfoil', 'foil', 'etched')),
      condition TEXT NOT NULL CHECK (condition IN ('NM', 'LP', 'MP', 'HP', 'DMG')),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      scryfall_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (namespace_id, scryfall_id, finish, condition)
    );
    CREATE INDEX IF NOT EXISTS cards_namespace_name_idx ON cards(namespace_id, name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS cards_namespace_set_idx ON cards(namespace_id, set_code, collector_number);
  `);
  return db;
}

function createCardStore(db, namespaceId) {
  if (!namespaceId || !namespaceId.trim()) throw new Error('COLLECTION_NAMESPACE_ID must not be empty');
  const insert = db.prepare(`
    INSERT INTO cards (namespace_id, name, set_code, set_name, collector_number, finish, condition, quantity, scryfall_id)
    VALUES (@namespaceId, @name, @setCode, @setName, @collectorNumber, @finish, @condition, @quantity, @scryfallId)
    ON CONFLICT(namespace_id, scryfall_id, finish, condition) DO UPDATE SET
      quantity = cards.quantity + excluded.quantity,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `);

  return {
    addMany(cards) {
      const save = db.transaction((items) => items.map((card) => insert.run({ ...card, namespaceId })));
      return save(cards);
    },
    list({ search = '', limit = 500, offset = 0 } = {}) {
      const term = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      return db.prepare(`
        SELECT id, name, set_code AS setCode, set_name AS setName,
          collector_number AS collectorNumber, finish, condition, quantity,
          scryfall_id AS scryfallId, created_at AS createdAt, updated_at AS updatedAt
        FROM cards
        WHERE namespace_id = ?
          AND (? = '' OR name LIKE ? ESCAPE '\\' OR set_name LIKE ? ESCAPE '\\' OR set_code LIKE ? ESCAPE '\\' OR collector_number LIKE ? ESCAPE '\\')
        ORDER BY name COLLATE NOCASE, set_code, collector_number
        LIMIT ? OFFSET ?
      `).all(namespaceId, search, term, term, term, term, limit, offset);
    },
    count() {
      return db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(quantity), 0) AS copies FROM cards WHERE namespace_id = ?').get(namespaceId);
    }
  };
}

module.exports = { createDatabase, createCardStore };

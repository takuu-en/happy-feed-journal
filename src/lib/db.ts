import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(path.join(dataDir, "journal.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      baby_name TEXT NOT NULL,
      kind TEXT NOT NULL,
      food TEXT NOT NULL DEFAULT '',
      amount TEXT NOT NULL DEFAULT '',
      mood TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      fed_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  return db;
}

export default getDb;

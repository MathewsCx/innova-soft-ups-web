import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const databaseDirectory = fileURLToPath(new URL("../../database/", import.meta.url));
const schemaPath = path.join(databaseDirectory, "schema.sql");

export function createDatabase(filename = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(databaseDirectory, "database.sqlite")) {
    if (filename !== ":memory:") {
        mkdirSync(path.dirname(filename), { recursive: true });
    }

    const database = new Database(filename);
    database.pragma("foreign_keys = ON");
    database.pragma("busy_timeout = 5000");
    database.exec(readFileSync(schemaPath, "utf8"));

    return database;
}

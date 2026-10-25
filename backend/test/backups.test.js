import { test } from "node:test"
import assert from "node:assert/strict"
import { PGlite } from "@electric-sql/pglite"
import { readFile, readdir } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import { snapshot, pack, unpack, restoreSnapshot } from "../src/backups.js"
test("encrypted snapshot restores into empty database and refuses overwrite or corruption", async () => {
  const key = process.env.BACKUP_ENCRYPTION_KEY
  process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString("base64")
  const source = new PGlite(),
    target = new PGlite(),
    pool = (db) => ({
      query: (q, a) => db.query(q, a),
      connect: async () => ({ query: (q, a) => db.query(q, a), release() {} }),
    })
  try {
    for (const db of [source, target])
      for (const f of (
        await readdir(new URL("../migrations/", import.meta.url))
      ).sort())
        await db.exec(
          await readFile(
            new URL("../migrations/" + f, import.meta.url),
            "utf8",
          ),
        )
    await source.query(
      "INSERT INTO sites VALUES('10000000-0000-4000-8000-000000000001','Fictional backup site')",
    )
    const original = await snapshot(pool(source)),
      bytes = pack(original)
    assert.ok(!bytes.includes(Buffer.from("Fictional backup site")))
    const corrupt = Buffer.from(bytes)
    corrupt[30] ^= 1
    assert.throws(() => unpack(corrupt))
    await restoreSnapshot(pool(target), unpack(bytes))
    assert.equal(
      (await target.query("SELECT name FROM sites")).rows[0].name,
      "Fictional backup site",
    )
    await assert.rejects(
      () => restoreSnapshot(pool(target), unpack(bytes)),
      /must be empty/,
    )
  } finally {
    await source.close()
    await target.close()
    if (key === undefined) delete process.env.BACKUP_ENCRYPTION_KEY
    else process.env.BACKUP_ENCRYPTION_KEY = key
  }
})

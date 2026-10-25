import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import {
  encodePhoto,
  decodePhoto,
  encryptionKey,
} from "../src/photo-storage.js"
test("encrypted evidence round trip, tamper rejection and legacy migration", () => {
  const previous = process.env.PHOTO_ENCRYPTION_KEY
  try {
    process.env.PHOTO_ENCRYPTION_KEY = randomBytes(32).toString("base64")
    const plain = Buffer.from("private fictional image bytes"),
      encrypted = encodePhoto(plain)
    assert.ok(!encrypted.includes(plain))
    assert.deepEqual(decodePhoto(encrypted), plain)
    const tampered = Buffer.from(encrypted)
    tampered[tampered.length - 1] ^= 1
    assert.throws(() => decodePhoto(tampered))
    assert.deepEqual(decodePhoto(plain), plain)
    process.env.PHOTO_ENCRYPTION_KEY = "invalid"
    assert.throws(() => encryptionKey())
  } finally {
    if (previous === undefined) delete process.env.PHOTO_ENCRYPTION_KEY
    else process.env.PHOTO_ENCRYPTION_KEY = previous
  }
})

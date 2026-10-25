import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
const MAGIC = Buffer.from("BCCPHOTO1")
export function encryptionKey() {
  const raw = process.env.PHOTO_ENCRYPTION_KEY
  if (!raw) return null
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32)
    throw Error(
      "PHOTO_ENCRYPTION_KEY must contain 32 random bytes encoded as base64",
    )
  return key
}
export function encodePhoto(data) {
  const key = encryptionKey()
  if (!key) return data
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, nonce)
  return Buffer.concat([
    MAGIC,
    nonce,
    cipher.update(data),
    cipher.final(),
    cipher.getAuthTag(),
  ])
}
export function decodePhoto(data) {
  if (!data.subarray(0, MAGIC.length).equals(MAGIC)) return data
  const key = encryptionKey()
  if (!key) throw Error("Encrypted photo key is unavailable")
  const nonce = data.subarray(MAGIC.length, MAGIC.length + 12),
    decipher = createDecipheriv("aes-256-gcm", key, nonce)
  decipher.setAuthTag(data.subarray(-16))
  return Buffer.concat([
    decipher.update(data.subarray(MAGIC.length + 12, -16)),
    decipher.final(),
  ])
}

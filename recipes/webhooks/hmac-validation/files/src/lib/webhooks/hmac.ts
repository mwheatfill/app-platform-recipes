export interface VerifyHmacOptions {
  payload: string | ArrayBuffer
  signature: string
  secret: string
  prefix?: string
}

// crypto.subtle.verify performs constant-time comparison internally.
const encoder = new TextEncoder()
const keyCache = new Map<string, Promise<CryptoKey>>()

function getHmacKey(secret: string): Promise<CryptoKey> {
  let cached = keyCache.get(secret)
  if (!cached) {
    cached = crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    keyCache.set(secret, cached)
  }
  return cached
}

export async function verifyHmacSignature(opts: VerifyHmacOptions): Promise<boolean> {
  const sig =
    opts.prefix && opts.signature.startsWith(opts.prefix)
      ? opts.signature.slice(opts.prefix.length)
      : opts.signature
  const sigBytes = hexToBytes(sig)
  if (!sigBytes) return false

  const key = await getHmacKey(opts.secret)
  const payloadBytes =
    typeof opts.payload === 'string' ? encoder.encode(opts.payload) : new Uint8Array(opts.payload)
  try {
    return await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes)
  } catch {
    return false
  }
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    const b = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(b)) return null
    bytes[i] = b
  }
  return bytes
}

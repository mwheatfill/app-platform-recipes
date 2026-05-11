export type HmacAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512'

export interface VerifyHmacOptions {
  payload: string | ArrayBuffer
  // Accept a string (single signature) or array (rotation: multiple
  // valid signatures in flight, e.g. Stripe / Slack during secret roll).
  signature: string | readonly string[]
  secret: string
  algorithm?: HmacAlgorithm
  prefix?: string
}

// crypto.subtle.verify performs constant-time comparison internally.
// keyCache accretes one entry per distinct secret+algorithm per isolate.
// Bounded by source count, not request count; swap to an LRU if per-tenant
// secrets ever produce unbounded distinct keys.
const encoder = new TextEncoder()
const keyCache = new Map<string, Promise<CryptoKey>>()

function getHmacKey(secret: string, algorithm: HmacAlgorithm): Promise<CryptoKey> {
  const cacheKey = `${algorithm}:${secret}`
  let cached = keyCache.get(cacheKey)
  if (!cached) {
    cached = crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: algorithm },
      false,
      ['verify'],
    )
    keyCache.set(cacheKey, cached)
  }
  return cached
}

export async function verifyHmacSignature(opts: VerifyHmacOptions): Promise<boolean> {
  const algorithm = opts.algorithm ?? 'SHA-256'
  const signatures = typeof opts.signature === 'string' ? [opts.signature] : opts.signature
  if (signatures.length === 0) return false

  const key = await getHmacKey(opts.secret, algorithm)
  const payloadBytes =
    typeof opts.payload === 'string' ? encoder.encode(opts.payload) : new Uint8Array(opts.payload)

  for (const raw of signatures) {
    const stripped =
      opts.prefix && raw.startsWith(opts.prefix) ? raw.slice(opts.prefix.length) : raw
    const sigBytes = hexToBytes(stripped)
    if (!sigBytes) continue
    try {
      if (await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes)) return true
    } catch {
      // try next signature
    }
  }
  return false
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

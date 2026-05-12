import { logError } from '@/lib/log'
import type { AcquireResult, LockDurableObject } from './lock-durable-object'

export type LockNamespace = DurableObjectNamespace<LockDurableObject>

export interface WithLockOptions {
  ttlSeconds: number
  holder?: string
}

// TTL must exceed expected fn duration; if fn outlasts the TTL, the
// lock expires mid-work and a concurrent caller may acquire. Returns
// null when the lock is already held; the AcquireResult on the held
// stub is available via stub.status() if the caller needs the holder.
export async function withLock<T>(
  namespace: LockNamespace,
  key: string,
  opts: WithLockOptions,
  fn: () => Promise<T>,
): Promise<T | null> {
  const stub = namespace.getByName(key)
  const result = await stub.acquire({
    ttlSeconds: opts.ttlSeconds,
    ...(opts.holder !== undefined ? { holder: opts.holder } : {}),
  })
  if (!result.acquired) return null
  try {
    return await fn()
  } finally {
    try {
      await stub.release()
    } catch (err) {
      logError('lock.release.failed', err, { key })
    }
  }
}

// Returns the full AcquireResult so callers can read the current
// holder/expiresAt without a second RPC call to status().
export async function tryAcquireLock(
  namespace: LockNamespace,
  key: string,
  opts: WithLockOptions,
): Promise<AcquireResult> {
  return namespace.getByName(key).acquire({
    ttlSeconds: opts.ttlSeconds,
    ...(opts.holder !== undefined ? { holder: opts.holder } : {}),
  })
}

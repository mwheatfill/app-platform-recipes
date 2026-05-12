import { DurableObject } from 'cloudflare:workers'

interface LockState {
  expiresAt: number
  holder?: string
}

export interface AcquireResult {
  acquired: boolean
  // Always populated. On success: the new lock's expiry. On failure:
  // the current holder's expiry (so the caller knows when to retry).
  expiresAt: number
  holder?: string
}

export type LockStatus =
  | { held: false }
  | { held: true; expiresAt: number; holder?: string }

// TTL is the safety net: if the holder crashes before release(), the
// lock auto-expires. The DO's single-threadedness makes get/check/put
// atomic without explicit transactions.
export class LockDurableObject extends DurableObject<Cloudflare.Env> {
  async acquire(opts: { ttlSeconds: number; holder?: string }): Promise<AcquireResult> {
    const existing = await this.ctx.storage.get<LockState>('lock')
    const now = Date.now()
    if (existing && existing.expiresAt > now) {
      return {
        acquired: false,
        expiresAt: existing.expiresAt,
        ...(existing.holder !== undefined ? { holder: existing.holder } : {}),
      }
    }
    const next: LockState = {
      expiresAt: now + opts.ttlSeconds * 1000,
      ...(opts.holder !== undefined ? { holder: opts.holder } : {}),
    }
    await this.ctx.storage.put('lock', next)
    return {
      acquired: true,
      expiresAt: next.expiresAt,
      ...(next.holder !== undefined ? { holder: next.holder } : {}),
    }
  }

  // deleteAll (not delete) clears residual metadata so the DO can be
  // evicted and stop incurring storage. Per Durable Objects docs.
  async release(): Promise<void> {
    await this.ctx.storage.deleteAll()
  }

  async status(): Promise<LockStatus> {
    const state = await this.ctx.storage.get<LockState>('lock')
    if (!state || state.expiresAt <= Date.now()) return { held: false }
    return {
      held: true,
      expiresAt: state.expiresAt,
      ...(state.holder !== undefined ? { holder: state.holder } : {}),
    }
  }
}

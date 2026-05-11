import { env } from 'cloudflare:workers'
import type { User } from '@/shared/schemas/auth'
import { toUser, verifyAccessJwt } from './cloudflare-access-provider'

export type { User }

export async function getCurrentUser(request: Request): Promise<User | null> {
  if (env.DEV_AUTH_BYPASS_USER) {
    return parseDevBypass(env.DEV_AUTH_BYPASS_USER)
  }
  return verifyAccessJwt(request)
}

let cachedRaw: string | null = null
let cachedUser: User | null = null

function parseDevBypass(raw: string): User | null {
  if (raw === cachedRaw) return cachedUser
  cachedRaw = raw
  try {
    cachedUser = toUser(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    cachedUser = null
  }
  return cachedUser
}

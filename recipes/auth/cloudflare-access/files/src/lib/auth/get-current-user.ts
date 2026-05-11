import { env } from 'cloudflare:workers'
import type { User } from '@/shared/schemas/auth'
import { verifyAccessJwt } from './cloudflare-access-provider'

export type { User }

// Cloudflare Access implementation of the template's getCurrentUser
// abstraction (ADR-005). App code reads identity only through this
// function; swapping providers replaces this file plus its sibling.

export async function getCurrentUser(request: Request): Promise<User | null> {
  if (env.DEV_AUTH_BYPASS_USER) {
    return parseDevBypass(env.DEV_AUTH_BYPASS_USER)
  }
  return verifyAccessJwt(request)
}

function parseDevBypass(raw: string): User | null {
  try {
    const parsed = JSON.parse(raw) as Partial<User>
    if (typeof parsed.id !== 'string' || typeof parsed.email !== 'string') {
      return null
    }
    const groups = Array.isArray(parsed.groups)
      ? parsed.groups.filter((g): g is string => typeof g === 'string')
      : []
    return {
      id: parsed.id,
      email: parsed.email,
      groups,
      ...(typeof parsed.name === 'string' ? { name: parsed.name } : {}),
      ...(typeof parsed.image === 'string' ? { image: parsed.image } : {}),
    }
  } catch {
    return null
  }
}

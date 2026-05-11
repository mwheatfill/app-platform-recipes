import { env } from 'cloudflare:workers'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { User } from '@/shared/schemas/auth'

const JWT_HEADER = 'cf-access-jwt-assertion'

const jwks = env.TEAM_DOMAIN
  ? createRemoteJWKSet(new URL(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`))
  : null

interface UserInput {
  id?: unknown
  email?: unknown
  name?: unknown
  image?: unknown
  groups?: unknown
}

export function toUser(input: UserInput): User | null {
  const id = typeof input.id === 'string' && input.id.length > 0 ? input.id : null
  const email = typeof input.email === 'string' && input.email.length > 0 ? input.email : null
  if (!id || !email) return null
  const groups = Array.isArray(input.groups)
    ? input.groups.filter((g): g is string => typeof g === 'string')
    : []
  const name = typeof input.name === 'string' ? input.name : undefined
  const image = typeof input.image === 'string' ? input.image : undefined
  return {
    id,
    email,
    groups,
    ...(name !== undefined ? { name } : {}),
    ...(image !== undefined ? { image } : {}),
  }
}

export async function verifyAccessJwt(request: Request): Promise<User | null> {
  if (!jwks || !env.POLICY_AUD || !env.TEAM_DOMAIN) return null
  const token = request.headers.get(JWT_HEADER)
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.TEAM_DOMAIN,
      audience: env.POLICY_AUD,
    })
    const sub = typeof payload.sub === 'string' ? payload.sub : ''
    const email = typeof payload.email === 'string' ? payload.email : ''
    return toUser({
      id: sub.length > 0 ? sub : email,
      email,
      name: payload.name,
      image: payload.picture,
      groups: payload.groups,
    })
  } catch {
    return null
  }
}

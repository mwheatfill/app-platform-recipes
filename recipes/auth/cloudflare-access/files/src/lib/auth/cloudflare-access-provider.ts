import { env } from 'cloudflare:workers'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { User } from '@/shared/schemas/auth'

const JWT_HEADER = 'cf-access-jwt-assertion'

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (jwks) return jwks
  if (!env.TEAM_DOMAIN) {
    throw new Error('Cloudflare Access: TEAM_DOMAIN env var is required.')
  }
  jwks = createRemoteJWKSet(new URL(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`))
  return jwks
}

export async function verifyAccessJwt(request: Request): Promise<User | null> {
  if (!env.POLICY_AUD || !env.TEAM_DOMAIN) return null
  const token = request.headers.get(JWT_HEADER)
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: env.TEAM_DOMAIN,
      audience: env.POLICY_AUD,
    })

    // Service tokens leave sub empty; user-identity tokens have a non-empty
    // sub. Fall back to email when sub is missing so service-token requests
    // still get a stable id, but most apps gate service tokens separately.
    const sub = typeof payload.sub === 'string' ? payload.sub : ''
    const email = typeof payload.email === 'string' ? payload.email : ''
    const id = sub.length > 0 ? sub : email
    if (!id || !email) return null

    const name = typeof payload.name === 'string' ? payload.name : undefined
    const image = typeof payload.picture === 'string' ? payload.picture : undefined
    const groups = Array.isArray(payload.groups)
      ? payload.groups.filter((g): g is string => typeof g === 'string')
      : []

    return {
      id,
      email,
      groups,
      ...(name !== undefined ? { name } : {}),
      ...(image !== undefined ? { image } : {}),
    }
  } catch {
    return null
  }
}

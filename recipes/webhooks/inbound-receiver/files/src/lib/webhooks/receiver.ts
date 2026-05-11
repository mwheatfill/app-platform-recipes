import { logError } from '@/lib/log'
import { type HmacAlgorithm, verifyHmacSignature } from './hmac'

export interface InboundWebhookMessage {
  source: string
  receivedAt: number
  headers: Record<string, string>
  body: string
  archiveKey?: string
}

export interface InboundWebhookOptions {
  request: Request
  secret: string
  signatureHeader: string
  signaturePrefix?: string
  signatureAlgorithm?: HmacAlgorithm
  replayWindow?: { timestamp: number; maxAgeSeconds: number }
  idempotency?: { kv: KVNamespace; keyHeader: string; ttlSeconds?: number }
  captureHeaders?: readonly string[]
  queue?: Queue<InboundWebhookMessage>
  archive?: { bucket: R2Bucket; prefix: string }
}

export interface InboundWebhookResult {
  status: number
  body: string
}

const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60

export async function handleInboundWebhook(
  source: string,
  opts: InboundWebhookOptions,
): Promise<InboundWebhookResult> {
  const {
    request,
    secret,
    signatureHeader,
    signaturePrefix,
    signatureAlgorithm,
    replayWindow,
    idempotency,
    captureHeaders,
    queue,
    archive,
  } = opts

  const signature = request.headers.get(signatureHeader)
  if (!signature) {
    return { status: 401, body: 'Missing signature' }
  }

  if (replayWindow) {
    const ageSeconds = Math.abs(Date.now() / 1000 - replayWindow.timestamp)
    if (ageSeconds > replayWindow.maxAgeSeconds) {
      logError('webhook.replay.stale', undefined, { source, ageSeconds })
      return { status: 401, body: 'Stale timestamp' }
    }
  }

  const body = await request.text()
  const valid = await verifyHmacSignature({
    payload: body,
    signature,
    secret,
    ...(signaturePrefix !== undefined ? { prefix: signaturePrefix } : {}),
    ...(signatureAlgorithm !== undefined ? { algorithm: signatureAlgorithm } : {}),
  })
  if (!valid) {
    logError('webhook.signature.invalid', undefined, { source })
    return { status: 401, body: 'Invalid signature' }
  }

  const idempotencyKey = idempotency ? request.headers.get(idempotency.keyHeader) : null
  const idempotencyKvKey = idempotencyKey ? `${source}:${idempotencyKey}` : null
  if (idempotency && idempotencyKvKey) {
    const existing = await idempotency.kv.get(idempotencyKvKey)
    if (existing !== null) {
      return { status: 200, body: 'OK (duplicate)' }
    }
  }

  const receivedAt = Date.now()
  const archiveKey = archive
    ? `${archive.prefix}/${source}/${receivedAt}-${crypto.randomUUID()}`
    : undefined

  const headers: Record<string, string> = {}
  if (captureHeaders && queue) {
    for (const name of captureHeaders) {
      const value = request.headers.get(name)
      if (value !== null) headers[name] = value
    }
  }

  const work: Promise<unknown>[] = []
  if (archive && archiveKey) {
    work.push(
      archive.bucket.put(archiveKey, body, {
        httpMetadata: {
          contentType: request.headers.get('content-type') ?? 'application/octet-stream',
        },
      }),
    )
  }
  if (queue) {
    work.push(
      queue.send({
        source,
        receivedAt,
        headers,
        body,
        ...(archiveKey !== undefined ? { archiveKey } : {}),
      }),
    )
  }
  await Promise.all(work)

  if (idempotency && idempotencyKvKey) {
    await idempotency.kv.put(idempotencyKvKey, String(receivedAt), {
      expirationTtl: idempotency.ttlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS,
    })
  }

  return { status: 200, body: 'OK' }
}

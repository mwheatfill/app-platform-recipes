import { logError } from '@/lib/log'
import { verifyHmacSignature } from './hmac'

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
  // Header names to copy into the queued message. Default empty; the
  // raw request headers contain auth cookies, IP, and the signature
  // itself, none of which belong in downstream queue storage.
  captureHeaders?: readonly string[]
  queue?: Queue<InboundWebhookMessage>
  archive?: { bucket: R2Bucket; prefix: string }
}

export interface InboundWebhookResult {
  status: number
  body: string
}

export async function handleInboundWebhook(
  source: string,
  opts: InboundWebhookOptions,
): Promise<InboundWebhookResult> {
  const { request, secret, signatureHeader, signaturePrefix, captureHeaders, queue, archive } = opts
  const signature = request.headers.get(signatureHeader)
  if (!signature) {
    return { status: 401, body: 'Missing signature' }
  }

  const body = await request.text()
  const valid = await verifyHmacSignature({
    payload: body,
    signature,
    secret,
    ...(signaturePrefix !== undefined ? { prefix: signaturePrefix } : {}),
  })
  if (!valid) {
    logError('webhook.signature.invalid', undefined, { source })
    return { status: 401, body: 'Invalid signature' }
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

  return { status: 200, body: 'OK' }
}

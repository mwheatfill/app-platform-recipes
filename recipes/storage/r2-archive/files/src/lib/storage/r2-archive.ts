export interface ArchiveKeyParts {
  prefix: string
  source: string
  receivedAt?: number
  id?: string
}

// Date-prefixed key avoids hot prefixes; UUID suffix avoids collisions
// when many archives arrive in the same millisecond.
export function composeArchiveKey(parts: ArchiveKeyParts): string {
  const ts = parts.receivedAt ?? Date.now()
  const id = parts.id ?? crypto.randomUUID()
  return `${parts.prefix}/${parts.source}/${ts}-${id}`
}

export interface PutArchiveOptions {
  contentType?: string
  metadata?: Record<string, string>
}

export async function putArchive(
  bucket: R2Bucket,
  key: string,
  body: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
  options?: PutArchiveOptions,
): Promise<R2Object | null> {
  const putOptions: R2PutOptions = {}
  if (options?.contentType) putOptions.httpMetadata = { contentType: options.contentType }
  if (options?.metadata) putOptions.customMetadata = options.metadata
  return bucket.put(key, body, putOptions)
}

export interface GetArchiveTextOptions {
  // Reject objects larger than this many bytes before reading the body.
  // Workers have a 128 MB memory ceiling; large archives should stream
  // via bucket.get(key) directly instead.
  maxBytes?: number
}

export interface ArchiveTextResult {
  text: string
  metadata: Record<string, string>
  uploaded: Date
  size: number
}

export async function getArchiveText(
  bucket: R2Bucket,
  key: string,
  options?: GetArchiveTextOptions,
): Promise<ArchiveTextResult | null> {
  const object = await bucket.get(key)
  if (object === null) return null
  if (options?.maxBytes !== undefined && object.size > options.maxBytes) {
    throw new Error(`Archive ${key} (${object.size} bytes) exceeds maxBytes ${options.maxBytes}`)
  }
  return {
    text: await object.text(),
    metadata: object.customMetadata ?? {},
    uploaded: object.uploaded,
    size: object.size,
  }
}

export interface ListArchiveOptions {
  cursor?: string
  limit?: number
  // Default false. Per R2 docs, including metadata caps the page below
  // limit; only set when the caller will actually read metadata.
  includeMetadata?: boolean
}

export interface ListArchiveResult {
  objects: R2Object[]
  cursor?: string
  truncated: boolean
}

export async function listArchive(
  bucket: R2Bucket,
  prefix: string,
  options?: ListArchiveOptions,
): Promise<ListArchiveResult> {
  const result = await bucket.list({
    prefix,
    ...(options?.includeMetadata ? { include: ['customMetadata' as const] } : {}),
    ...(options?.cursor !== undefined ? { cursor: options.cursor } : {}),
    ...(options?.limit !== undefined ? { limit: options.limit } : {}),
  })
  return {
    objects: result.objects,
    truncated: result.truncated,
    ...(result.truncated ? { cursor: result.cursor } : {}),
  }
}

// Per R2 docs: never use objects.length as a pagination signal; only
// truncated is reliable.
export async function* iterateArchive(
  bucket: R2Bucket,
  prefix: string,
  options?: { limit?: number; includeMetadata?: boolean },
): AsyncGenerator<R2Object> {
  let cursor: string | undefined
  do {
    const result = await bucket.list({
      prefix,
      ...(options?.includeMetadata ? { include: ['customMetadata' as const] } : {}),
      ...(options?.limit !== undefined ? { limit: options.limit } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    })
    for (const obj of result.objects) yield obj
    cursor = result.truncated ? result.cursor : undefined
  } while (cursor !== undefined)
}

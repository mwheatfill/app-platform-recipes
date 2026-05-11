import { logError } from '@/lib/log'

export type QueueMessageHandler<T> = (
  message: Message<T>,
  env: Cloudflare.Env,
  ctx: ExecutionContext,
) => Promise<void>

// Processes messages in parallel with independent ack/retry. Queues
// doesn't guarantee order, so sequential iteration only multiplies
// batch latency. Failures log via @/lib/log; the platform retries up
// to wrangler's max_retries then routes to the configured DLQ.
export async function consumeQueueBatch<T>(
  batch: MessageBatch<T>,
  env: Cloudflare.Env,
  ctx: ExecutionContext,
  processOne: QueueMessageHandler<T>,
): Promise<void> {
  await Promise.all(
    batch.messages.map(async (message) => {
      try {
        await processOne(message, env, ctx)
        message.ack()
      } catch (err) {
        logError('queue.message.failed', err, {
          id: message.id,
          attempts: message.attempts,
        })
        message.retry()
      }
    }),
  )
}

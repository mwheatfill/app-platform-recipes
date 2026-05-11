export async function sendToQueue<T>(queue: Queue<T>, body: T): Promise<void> {
  await queue.send(body)
}

export async function sendBatchToQueue<T>(queue: Queue<T>, bodies: T[]): Promise<void> {
  await queue.sendBatch(bodies.map((body) => ({ body })))
}

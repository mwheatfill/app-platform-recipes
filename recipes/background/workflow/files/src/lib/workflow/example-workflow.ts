import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'

export interface ExampleWorkflowParams {
  jobId: string
}

export interface ExampleWorkflowResult {
  jobId: string
  fetchedAt: number
  attempt: number
  processedAt: number
}

export class ExampleWorkflow extends WorkflowEntrypoint<Cloudflare.Env, ExampleWorkflowParams> {
  async run(
    event: WorkflowEvent<ExampleWorkflowParams>,
    step: WorkflowStep,
  ): Promise<ExampleWorkflowResult> {
    const fetched = await step.do('fetch', async () => ({
      jobId: event.payload.jobId,
      fetchedAt: Date.now(),
    }))

    await step.sleep('cool-down', '5 seconds')

    return step.do(
      'process',
      { retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' } },
      async (ctx) => ({ ...fetched, attempt: ctx.attempt, processedAt: Date.now() }),
    )
  }
}

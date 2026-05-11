import { logInfo } from '@/lib/log'

export async function handleScheduled(
  controller: ScheduledController,
  _env: Cloudflare.Env,
  _ctx: ExecutionContext,
): Promise<void> {
  logInfo('scheduled.fired', {
    cron: controller.cron,
    scheduledTime: controller.scheduledTime,
  })
  // Dispatch your work here. Use ctx.waitUntil(promise) for async
  // work that should outlive the handler return.
}

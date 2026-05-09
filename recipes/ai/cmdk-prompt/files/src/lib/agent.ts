export interface AgentToolCall {
  name: string;
  input: unknown;
  output: unknown;
}

export interface AgentResponse {
  text: string;
  toolCalls?: AgentToolCall[];
  finishReason?: string;
}

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export async function ask(message: string, signal?: AbortSignal): Promise<AgentResponse> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!res.ok) {
    let details: unknown = undefined;
    try {
      details = await res.json();
    } catch {}
    throw new AgentError(`ask failed: ${res.status} ${res.statusText}`, res.status, details);
  }

  return (await res.json()) as AgentResponse;
}

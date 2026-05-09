import { useCallback, useState, type FormEvent } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ask, type AgentResponse, AgentError } from "@/lib/agent";
import { useAgentPromptKeybinding } from "./keybinding";

interface AskState {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  response?: AgentResponse;
  error?: string;
}

export function AgentPromptDialog() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AskState>({ status: "idle", message: "" });

  useAgentPromptKeybinding(() => setOpen((v) => !v));

  const onSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const message = state.message.trim();
      if (!message) return;
      setState((s) => ({ ...s, status: "loading", error: undefined }));
      try {
        const response = await ask(message);
        setState((s) => ({ ...s, status: "success", response }));
      } catch (err) {
        const msg =
          err instanceof AgentError
            ? `${err.message}${err.details ? ` — ${JSON.stringify(err.details)}` : ""}`
            : err instanceof Error
              ? err.message
              : "Unknown error";
        setState((s) => ({ ...s, status: "error", error: msg }));
      }
    },
    [state.message],
  );

  const reset = () =>
    setState({ status: "idle", message: "", response: undefined, error: undefined });

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-2xl gap-3 p-0 sm:rounded-xl">
        <form onSubmit={onSubmit} className="border-b p-3">
          <Input
            autoFocus
            data-allow-agent-prompt="true"
            placeholder="Ask anything…"
            value={state.message}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setState((s) => ({ ...s, message: e.target.value }))
            }
            className="h-12 border-0 px-2 text-base shadow-none focus-visible:ring-0"
            disabled={state.status === "loading"}
          />
        </form>

        {state.status === "idle" && (
          <div className="px-4 pb-4 text-sm text-muted-foreground">
            Type a question. Press Enter to ask.
            <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              ⌘K
            </kbd>
            <span className="ml-1">to close</span>
          </div>
        )}

        {state.status === "loading" && (
          <div className="px-4 pb-4 text-sm text-muted-foreground">Thinking…</div>
        )}

        {state.status === "error" && (
          <div className="px-4 pb-4 text-sm text-destructive">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1 break-words font-mono text-xs">{state.error}</p>
          </div>
        )}

        {state.status === "success" && state.response && (
          <div className="space-y-3 px-4 pb-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{state.response.text}</p>
            {state.response.toolCalls && state.response.toolCalls.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {state.response.toolCalls.length} tool call
                  {state.response.toolCalls.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-2 space-y-1 font-mono">
                  {state.response.toolCalls.map((tc, i) => (
                    <li key={`${tc.name}-${i}`} className="rounded bg-muted px-2 py-1">
                      {tc.name}({JSON.stringify(tc.input)})
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={reset}>
                Ask another
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

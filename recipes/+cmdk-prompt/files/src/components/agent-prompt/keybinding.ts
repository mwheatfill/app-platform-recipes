import { useEffect } from "react";

/**
 * Listen for ⌘K (mac) / Ctrl+K (others) and toggle a callback.
 *
 * Skips when the user is typing in an editable element so it doesn't hijack search inputs.
 */
export function useAgentPromptKeybinding(toggle: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key === "k";
      if (!isCmdK) return;
      const target = e.target as HTMLElement | null;
      const inEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (inEditable && target.dataset.allowAgentPrompt !== "true") return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);
}

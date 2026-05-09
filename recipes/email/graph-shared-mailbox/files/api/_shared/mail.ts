import { getGraphClient } from "./graph.js";

const SHARED_MAILBOX = process.env.SHARED_MAILBOX_ADDRESS;
const FROM_NAME = process.env.MAIL_FROM_NAME ?? "Notifications";

export interface MailRecipient {
  address: string;
  name?: string;
}

export interface SendMailOptions {
  to: string | string[] | MailRecipient | MailRecipient[];
  cc?: string | string[] | MailRecipient | MailRecipient[];
  bcc?: string | string[] | MailRecipient | MailRecipient[];
  subject: string;
  html: string;
  /** Plain text fallback. If omitted, the HTML is used as-is. */
  text?: string;
  /** Override the From address (must be a mailbox the app has SendAs permission for) */
  from?: string;
  /** Reply-To */
  replyTo?: string | string[];
  /** "high", "normal", "low" */
  importance?: "high" | "normal" | "low";
}

function toRecipientList(
  v: string | string[] | MailRecipient | MailRecipient[] | undefined,
): { emailAddress: { address: string; name?: string } }[] | undefined {
  if (v == null) return undefined;
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((entry) => {
    if (typeof entry === "string") return { emailAddress: { address: entry } };
    return { emailAddress: { address: entry.address, name: entry.name } };
  });
}

/**
 * Send mail via Microsoft Graph from the configured shared mailbox.
 * Requires Mail.Send (Application) permission, admin-consented.
 */
export async function sendMail(opts: SendMailOptions): Promise<void> {
  const fromAddress = opts.from ?? SHARED_MAILBOX;
  if (!fromAddress) {
    throw new Error(
      "No sender configured. Set SHARED_MAILBOX_ADDRESS in app settings or pass `from` explicitly.",
    );
  }

  const message = {
    subject: opts.subject,
    body: { contentType: "HTML", content: opts.html },
    toRecipients: toRecipientList(opts.to),
    ccRecipients: toRecipientList(opts.cc),
    bccRecipients: toRecipientList(opts.bcc),
    from: { emailAddress: { address: fromAddress, name: FROM_NAME } },
    replyTo: toRecipientList(opts.replyTo),
    importance: opts.importance ?? "normal",
  };

  const client = getGraphClient();
  await client
    .api(`/users/${encodeURIComponent(fromAddress)}/sendMail`)
    .post({ message, saveToSentItems: true });
}

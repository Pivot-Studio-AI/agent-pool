// ─── Command Parser ─────────────────────────────────────────────────
// Parses inbound text messages (WhatsApp / Telegram) into structured commands.

export type Command =
  | { type: 'APPROVE' }
  | { type: 'REJECT'; feedback: string }
  | { type: 'MERGE' }
  | { type: 'STATUS' }
  | { type: 'QUEUE' }
  | { type: 'BRIEF' }
  | { type: 'CANCEL'; taskId: string }
  | { type: 'NEW_TASK'; description: string };

/**
 * Parse a raw text message into a Command.
 *
 * Recognition rules (case-insensitive):
 *   "APPROVE"             → APPROVE
 *   "MERGE"               → MERGE
 *   "STATUS"              → STATUS
 *   "QUEUE"               → QUEUE
 *   "BRIEF"               → BRIEF (daily digest summary)
 *   "REJECT ..."          → REJECT with feedback (everything after "REJECT")
 *   "CANCEL ..."          → CANCEL with task ID (first 8 chars)
 *   anything else          → NEW_TASK with the full text as description
 */
export function parseCommand(text: string): Command {
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();

  if (upper === 'APPROVE') return { type: 'APPROVE' };
  if (upper === 'MERGE') return { type: 'MERGE' };
  if (upper === 'STATUS') return { type: 'STATUS' };
  if (upper === 'QUEUE') return { type: 'QUEUE' };
  if (upper === 'BRIEF') return { type: 'BRIEF' };

  if (upper.startsWith('REJECT')) {
    const feedback = trimmed.slice(6).trim() || 'No feedback provided';
    return { type: 'REJECT', feedback };
  }

  if (upper === 'CANCEL' || upper.startsWith('CANCEL ')) {
    const taskId = trimmed.slice(7).trim();
    return { type: 'CANCEL', taskId };
  }

  return { type: 'NEW_TASK', description: trimmed };
}

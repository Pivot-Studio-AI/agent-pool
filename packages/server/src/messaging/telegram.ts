// ─── Telegram Bot API Client ────────────────────────────────────────
// Sends notifications via Telegram and processes inbound commands/callbacks
// using long polling (no public webhook URL required).

import { parseCommand } from './command-parser.js';
import { createTask, getTask, listTasks, updateTaskStatus, type TaskRow } from '../services/task-service.js';
import { approvePlan, rejectPlan, getPlans, type PlanRow } from '../services/plan-service.js';
import { config } from '../config.js';

// ─── Types ──────────────────────────────────────────────────────────

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
  from?: { id: number; first_name: string };
}

interface TelegramCallbackQuery {
  id: string;
  message?: TelegramMessage;
  data?: string;
  from: { id: number; first_name: string };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface InlineKeyboard {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

interface MessageTaskMapping {
  taskId: string;
  planId?: string;
}

// ─── Client ─────────────────────────────────────────────────────────

export class TelegramBot {
  private botToken: string;
  private chatId: string;
  private messageTaskMap: Map<number, MessageTaskMapping> = new Map();
  private pollingActive = false;
  private lastUpdateId = 0;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
  }

  /** Returns true when all required env vars are present. */
  isConfigured(): boolean {
    return !!(this.botToken && this.chatId);
  }

  // ── Core API ──────────────────────────────────────────────────────

  private get baseUrl(): string {
    return `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Send a text message to the configured chat.
   * Returns the Telegram message_id for threading / inline-keyboard updates.
   */
  async sendMessage(
    text: string,
    parseMode: string = 'Markdown',
    replyMarkup?: InlineKeyboard,
  ): Promise<number | null> {
    if (!this.isConfigured()) return null;

    const body: Record<string, unknown> = {
      chat_id: this.chatId,
      text,
      parse_mode: parseMode,
    };

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    try {
      const res = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Telegram API error (${res.status}):`, errText);
        return null;
      }

      const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
      return data.result?.message_id ?? null;
    } catch (err) {
      console.error('Telegram sendMessage failed:', err);
      return null;
    }
  }

  /**
   * Answer a callback query (removes the "loading" spinner on inline buttons).
   */
  private async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || undefined,
        }),
      });
    } catch (err) {
      console.error('Telegram answerCallbackQuery failed:', err);
    }
  }

  // ── Notification helpers ──────────────────────────────────────────

  async sendPlanNotification(task: TaskRow, plan: PlanRow): Promise<void> {
    const contentPreview = (plan.content || '').slice(0, 200);
    const fileCount = Array.isArray(plan.file_manifest) ? plan.file_manifest.length : 0;

    const text = [
      `\u{1F4CB} *Plan Ready*`,
      task.title,
      '',
      `Approach: ${contentPreview}${plan.content.length > 200 ? '...' : ''}`,
      `Files: ${fileCount} files`,
    ].join('\n');

    const replyMarkup: InlineKeyboard = {
      inline_keyboard: [[
        { text: '\u2705 Approve', callback_data: `approve:${task.id}:${plan.id}` },
        { text: '\u274C Reject', callback_data: `reject:${task.id}:${plan.id}` },
      ]],
    };

    const msgId = await this.sendMessage(text, 'Markdown', replyMarkup);
    if (msgId) {
      this.messageTaskMap.set(msgId, { taskId: task.id, planId: plan.id });
    }
  }

  async sendReviewNotification(
    task: TaskRow,
    diff: { additions: number; deletions: number; files_changed: unknown[] },
  ): Promise<void> {
    const text = [
      `\u{1F50D} *Review Ready*`,
      task.title,
      '',
      `+${diff.additions} \u2212${diff.deletions} across ${diff.files_changed.length} files`,
      '',
      `[View in dashboard](${config.dashboardUrl}/tasks/${task.id})`,
    ].join('\n');

    const replyMarkup: InlineKeyboard = {
      inline_keyboard: [[
        { text: '\u{1F500} Merge', callback_data: `merge:${task.id}` },
        { text: '\u{1F4DD} Changes', callback_data: `changes:${task.id}` },
        { text: '\u274C Reject', callback_data: `reject_merge:${task.id}` },
      ]],
    };

    const msgId = await this.sendMessage(text, 'Markdown', replyMarkup);
    if (msgId) {
      this.messageTaskMap.set(msgId, { taskId: task.id });
    }
  }

  async sendErrorNotification(task: TaskRow, error: string): Promise<void> {
    const text = [
      `\u274C *Task Failed*`,
      task.title,
      '',
      error,
    ].join('\n');

    await this.sendMessage(text);
  }

  async sendMergeNotification(
    task: TaskRow,
    diff: { additions: number; deletions: number },
  ): Promise<void> {
    const text = [
      `\u2705 *Merged*`,
      task.title,
      '',
      `+${diff.additions} \u2212${diff.deletions} merged to ${task.target_branch}`,
    ].join('\n');

    await this.sendMessage(text);
  }

  async sendQuestionNotification(task: TaskRow, question: string): Promise<void> {
    const text = [
      `\u2753 *Agent Question*`,
      task.title,
      '',
      question,
      '',
      'Reply with your answer.',
    ].join('\n');

    const msgId = await this.sendMessage(text);
    if (msgId) {
      this.messageTaskMap.set(msgId, { taskId: task.id });
    }
  }

  // ── Long Polling ──────────────────────────────────────────────────

  /**
   * Start long-polling for updates. Runs until stopPolling() is called.
   * Safe to call multiple times — only one loop will be active.
   */
  startPolling(): void {
    if (!this.isConfigured()) {
      console.log('Telegram bot not configured — polling not started.');
      return;
    }

    if (this.pollingActive) return;
    this.pollingActive = true;

    console.log('Telegram bot polling started.');
    this.pollLoop();
  }

  stopPolling(): void {
    this.pollingActive = false;
    console.log('Telegram bot polling stopped.');
  }

  private async pollLoop(): Promise<void> {
    while (this.pollingActive) {
      try {
        const res = await fetch(
          `${this.baseUrl}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`,
          { signal: AbortSignal.timeout(35_000) },
        );

        if (!res.ok) {
          console.error(`Telegram getUpdates error (${res.status}):`, await res.text());
          // Back off briefly before retrying
          await this.sleep(5_000);
          continue;
        }

        const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };

        for (const update of data.result) {
          this.lastUpdateId = update.update_id;

          try {
            if (update.callback_query) {
              await this.handleCallbackQuery(update.callback_query);
            } else if (update.message) {
              await this.handleMessage(update.message);
            }
          } catch (err) {
            console.error('Error handling Telegram update:', err);
          }
        }
      } catch (err) {
        if (this.pollingActive) {
          console.error('Telegram polling error:', err);
          await this.sleep(5_000);
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Callback Query Handling ───────────────────────────────────────

  /**
   * Handle an inline keyboard button press.
   * callback_data format: "action:taskId" or "action:taskId:planId"
   */
  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const data = query.data || '';
    const parts = data.split(':');
    const action = parts[0];
    const taskId = parts[1];
    const planId = parts[2]; // may be undefined

    try {
      switch (action) {
        case 'approve': {
          if (!taskId || !planId) {
            await this.answerCallbackQuery(query.id, 'Missing task or plan ID.');
            return;
          }
          await approvePlan(planId);
          await updateTaskStatus(taskId, 'executing');
          await this.answerCallbackQuery(query.id, 'Plan approved!');
          await this.sendMessage(`\u2705 Plan approved for task ${taskId.slice(0, 8)}. Agent is now executing.`);
          break;
        }

        case 'reject': {
          if (!taskId || !planId) {
            await this.answerCallbackQuery(query.id, 'Missing task or plan ID.');
            return;
          }
          // Default reject via button — no inline feedback. User can send text follow-up.
          await rejectPlan(planId, 'Rejected via Telegram button');
          await updateTaskStatus(taskId, 'planning');
          await this.answerCallbackQuery(query.id, 'Plan rejected.');
          await this.sendMessage(`\u274C Plan rejected for task ${taskId.slice(0, 8)}. Agent will revise.\n\nSend feedback as a text message if needed.`);
          break;
        }

        case 'merge': {
          if (!taskId) {
            await this.answerCallbackQuery(query.id, 'Missing task ID.');
            return;
          }
          const task = await getTask(taskId);
          if (task.status !== 'awaiting_review') {
            await this.answerCallbackQuery(query.id, `Cannot merge — task is '${task.status}'.`);
            return;
          }
          await updateTaskStatus(taskId, 'merging');
          await this.answerCallbackQuery(query.id, 'Merge initiated!');
          await this.sendMessage(`\u{1F500} Merge initiated for "${task.title}".`);
          break;
        }

        case 'changes': {
          if (!taskId) {
            await this.answerCallbackQuery(query.id, 'Missing task ID.');
            return;
          }
          await this.answerCallbackQuery(query.id, 'View changes in the dashboard.');
          await this.sendMessage(`\u{1F4DD} View changes at: ${config.dashboardUrl}/tasks/${taskId}`);
          break;
        }

        case 'reject_merge': {
          if (!taskId) {
            await this.answerCallbackQuery(query.id, 'Missing task ID.');
            return;
          }
          const task = await getTask(taskId);
          if (task.status !== 'awaiting_review') {
            await this.answerCallbackQuery(query.id, `Cannot reject — task is '${task.status}'.`);
            return;
          }
          await updateTaskStatus(taskId, 'rejected');
          await this.answerCallbackQuery(query.id, 'Changes rejected.');
          await this.sendMessage(`\u274C Changes rejected for "${task.title}".`);
          break;
        }

        default:
          await this.answerCallbackQuery(query.id, `Unknown action: ${action}`);
      }
    } catch (err) {
      console.error('Telegram callback query error:', err);
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      await this.answerCallbackQuery(query.id, `Error: ${errMsg}`);
    }
  }

  // ── Text Message Handling ─────────────────────────────────────────

  /**
   * Handle a plain text message (same command set as WhatsApp).
   */
  private async handleMessage(message: TelegramMessage): Promise<void> {
    if (!message.text) return;

    // Only process messages from the configured chat
    if (String(message.chat.id) !== this.chatId) return;

    const command = parseCommand(message.text);

    try {
      switch (command.type) {
        case 'APPROVE': {
          // Without a reply context we can't know which task — try to find the latest awaiting_approval
          const tasks = await listTasks({ status: 'awaiting_approval', limit: 1 });
          if (tasks.length === 0) {
            await this.sendMessage('No tasks awaiting approval.');
            return;
          }
          const task = tasks[0];
          const plans = await getPlans(task.id);
          const pendingPlan = plans.find((p) => p.status === 'pending');
          if (!pendingPlan) {
            await this.sendMessage('No pending plan found.');
            return;
          }
          await approvePlan(pendingPlan.id);
          await updateTaskStatus(task.id, 'executing');
          await this.sendMessage(`\u2705 Plan approved for "${task.title}". Agent is now executing.`);
          break;
        }

        case 'REJECT': {
          const tasks = await listTasks({ status: 'awaiting_approval', limit: 1 });
          if (tasks.length === 0) {
            await this.sendMessage('No tasks awaiting approval.');
            return;
          }
          const task = tasks[0];
          const plans = await getPlans(task.id);
          const pendingPlan = plans.find((p) => p.status === 'pending');
          if (!pendingPlan) {
            await this.sendMessage('No pending plan found.');
            return;
          }
          await rejectPlan(pendingPlan.id, command.feedback);
          await updateTaskStatus(task.id, 'planning');
          await this.sendMessage(`\u274C Plan rejected for "${task.title}". Agent will revise.`);
          break;
        }

        case 'MERGE': {
          const tasks = await listTasks({ status: 'awaiting_review', limit: 1 });
          if (tasks.length === 0) {
            await this.sendMessage('No tasks awaiting review.');
            return;
          }
          const task = tasks[0];
          await updateTaskStatus(task.id, 'merging');
          await this.sendMessage(`\u{1F500} Merge initiated for "${task.title}".`);
          break;
        }

        case 'STATUS': {
          const activeTasks = await listTasks({
            statuses: ['planning', 'awaiting_approval', 'executing', 'awaiting_review', 'merging'],
          });

          if (activeTasks.length === 0) {
            await this.sendMessage('No active tasks.');
            return;
          }

          const lines = activeTasks.map(
            (t) => `\u2022 [${t.status}] ${t.title}`,
          );
          await this.sendMessage(`*Active Tasks (${activeTasks.length})*\n\n${lines.join('\n')}`);
          break;
        }

        case 'QUEUE': {
          const queuedTasks = await listTasks({ status: 'queued' });

          if (queuedTasks.length === 0) {
            await this.sendMessage('Queue is empty.');
            return;
          }

          const lines = queuedTasks.map(
            (t, i) => `${i + 1}. ${t.title} (${t.priority})`,
          );
          await this.sendMessage(`*Queued Tasks (${queuedTasks.length})*\n\n${lines.join('\n')}`);
          break;
        }

        case 'NEW_TASK': {
          const task = await createTask({
            title: command.description.slice(0, 100),
            description: command.description,
          });
          await this.sendMessage(`\u2705 Task created: "${task.title}" (${task.id.slice(0, 8)})`);
          break;
        }
      }
    } catch (err) {
      console.error('Telegram message handling error:', err);
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      await this.sendMessage(`\u26A0\uFE0F Error: ${errMsg}`);
    }
  }
}

export const telegramBot = new TelegramBot();

// ─── WhatsApp Business Cloud API Client ─────────────────────────────
// Sends notifications and processes inbound commands via the WhatsApp Business
// Cloud API (graph.facebook.com v18.0).

import { parseCommand } from './command-parser.js';
import { createTask, getTask, listTasks, updateTaskStatus, type TaskRow } from '../services/task-service.js';
import { approvePlan, rejectPlan, getPlans, type PlanRow } from '../services/plan-service.js';
import { config } from '../config.js';

// ─── Types ──────────────────────────────────────────────────────────

interface WhatsAppIncomingMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  context?: { message_id: string };
}

interface MessageTaskMapping {
  taskId: string;
  planId?: string;
  createdAt: number;
}

const MESSAGE_MAP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MESSAGE_MAP_MAX_SIZE = 500;

// ─── Client ─────────────────────────────────────────────────────────

export class WhatsAppClient {
  private phoneId: string;
  private accessToken: string;
  private userPhone: string;
  private messageTaskMap: Map<string, MessageTaskMapping> = new Map();

  constructor() {
    this.phoneId = process.env.WHATSAPP_PHONE_ID || '';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.userPhone = process.env.WHATSAPP_USER_PHONE || '';
  }

  /** Returns true when all required env vars are present. */
  isConfigured(): boolean {
    return !!(this.phoneId && this.accessToken && this.userPhone);
  }

  // ── Sending ───────────────────────────────────────────────────────

  /**
   * Send a plain-text message to the configured user phone number.
   * Optionally reply to a previous message via replyToMessageId.
   * Returns the WhatsApp message ID from the API response (for threading).
   */
  async sendMessage(text: string, replyToMessageId?: string): Promise<string | null> {
    if (!this.isConfigured()) return null;

    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: this.userPhone,
      type: 'text',
      text: { body: text },
    };

    if (replyToMessageId) {
      body.context = { message_id: replyToMessageId };
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${this.phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`WhatsApp API error (${res.status}):`, errText);
        return null;
      }

      const data = (await res.json()) as { messages?: { id: string }[] };
      return data.messages?.[0]?.id ?? null;
    } catch (err) {
      console.error('WhatsApp sendMessage failed:', err);
      return null;
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
      '',
      'Reply APPROVE or REJECT [feedback]',
    ].join('\n');

    const msgId = await this.sendMessage(text);
    if (msgId) {
      this.trackMessage(msgId, { taskId: task.id, planId: plan.id });
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
      `Reply MERGE, REJECT, or view at ${config.dashboardUrl}/tasks/${task.id}`,
    ].join('\n');

    const msgId = await this.sendMessage(text);
    if (msgId) {
      this.trackMessage(msgId, { taskId: task.id });
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
      this.trackMessage(msgId, { taskId: task.id });
    }
  }

  // ── Brief / Digest ──────────────────────────────────────────────

  async sendBrief(): Promise<void> {
    const activeTasks = await listTasks({
      statuses: ['planning', 'awaiting_approval', 'executing', 'awaiting_review', 'merging'],
    });

    const queuedTasks = await listTasks({ status: 'queued' });

    // Get tasks completed today
    const completedTasks = await listTasks({
      statuses: ['completed'],
      limit: 50,
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedToday = completedTasks.filter(
      (t) => t.completed_at && new Date(t.completed_at) >= today
    );

    const needsAttention = activeTasks.filter(
      (t) => t.status === 'awaiting_approval' || t.status === 'awaiting_review'
    );

    const executing = activeTasks.filter((t) => t.status === 'executing' || t.status === 'planning');

    const lines: string[] = ['\u{1F4CA} *Agent Pool Brief*', ''];

    if (needsAttention.length > 0) {
      lines.push(`*Needs Your Attention (${needsAttention.length})*`);
      for (const t of needsAttention) {
        const label = t.status === 'awaiting_approval' ? 'plan ready' : 'diff ready';
        lines.push(`\u2022 "${t.title}" \u2014 ${label}`);
      }
      lines.push('');
    }

    if (executing.length > 0) {
      lines.push(`*In Progress (${executing.length})*`);
      for (const t of executing) {
        lines.push(`\u2022 "${t.title}" \u2014 ${t.status}`);
      }
      lines.push('');
    }

    lines.push(`Queued: ${queuedTasks.length} task${queuedTasks.length !== 1 ? 's' : ''}`);
    lines.push(`Completed today: ${completedToday.length} task${completedToday.length !== 1 ? 's' : ''}`);

    await this.sendMessage(lines.join('\n'));
  }

  // ── Lookup ────────────────────────────────────────────────────────

  getTaskForMessage(messageId: string): MessageTaskMapping | undefined {
    return this.messageTaskMap.get(messageId);
  }

  /**
   * Track a message-to-task mapping with automatic TTL eviction.
   */
  private trackMessage(messageId: string, mapping: Omit<MessageTaskMapping, 'createdAt'>): void {
    // Evict stale entries
    const now = Date.now();
    if (this.messageTaskMap.size >= MESSAGE_MAP_MAX_SIZE) {
      for (const [id, entry] of this.messageTaskMap) {
        if (now - entry.createdAt > MESSAGE_MAP_TTL_MS) {
          this.messageTaskMap.delete(id);
        }
      }
    }
    this.messageTaskMap.set(messageId, { ...mapping, createdAt: now });
  }

  // ── Inbound handling ──────────────────────────────────────────────

  /**
   * Process an incoming WhatsApp message (called from the webhook route).
   */
  async handleIncomingMessage(message: WhatsAppIncomingMessage): Promise<void> {
    if (message.type !== 'text' || !message.text?.body) return;

    const text = message.text.body;
    const replyToId = message.context?.message_id;
    const command = parseCommand(text);

    // If this is a reply, try to find the associated task
    const mapping = replyToId ? this.messageTaskMap.get(replyToId) : undefined;

    try {
      switch (command.type) {
        case 'APPROVE': {
          if (!mapping) {
            await this.sendMessage('Reply to a plan notification to approve it.');
            return;
          }
          const plans = await getPlans(mapping.taskId);
          const pendingPlan = mapping.planId
            ? plans.find((p) => p.id === mapping.planId && p.status === 'pending')
            : plans.find((p) => p.status === 'pending');

          if (!pendingPlan) {
            await this.sendMessage('No pending plan found for this task.');
            return;
          }

          await approvePlan(pendingPlan.id);
          await updateTaskStatus(mapping.taskId, 'executing');
          await this.sendMessage(`\u2705 Plan approved. Agent is now executing.`);
          break;
        }

        case 'REJECT': {
          if (!mapping) {
            await this.sendMessage('Reply to a plan notification to reject it.');
            return;
          }
          const plans = await getPlans(mapping.taskId);
          const pendingPlan = mapping.planId
            ? plans.find((p) => p.id === mapping.planId && p.status === 'pending')
            : plans.find((p) => p.status === 'pending');

          if (!pendingPlan) {
            await this.sendMessage('No pending plan found for this task.');
            return;
          }

          await rejectPlan(pendingPlan.id, command.feedback);
          await updateTaskStatus(mapping.taskId, 'planning');
          await this.sendMessage(`\u274C Plan rejected. Agent will revise.`);
          break;
        }

        case 'MERGE': {
          if (!mapping) {
            await this.sendMessage('Reply to a review notification to merge.');
            return;
          }
          const task = await getTask(mapping.taskId);
          if (task.status !== 'awaiting_review') {
            await this.sendMessage(`Cannot merge \u2014 task is in '${task.status}' status.`);
            return;
          }
          await updateTaskStatus(mapping.taskId, 'merging');
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

        case 'BRIEF': {
          await this.sendBrief();
          break;
        }

        case 'CANCEL': {
          if (!command.taskId) {
            await this.sendMessage('Usage: CANCEL <task-id>');
            return;
          }
          try {
            await updateTaskStatus(command.taskId, 'cancelled', 'Cancelled via WhatsApp');
            await this.sendMessage(`\u{1F6D1} Task cancelled.`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            await this.sendMessage(`Cannot cancel: ${msg}`);
          }
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
      console.error('WhatsApp command handling error:', err);
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      await this.sendMessage(`\u26A0\uFE0F Error: ${errMsg}`);
    }
  }
}

export const whatsappClient = new WhatsAppClient();

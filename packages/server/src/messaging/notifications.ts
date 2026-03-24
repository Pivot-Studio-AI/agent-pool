// ─── Notification Dispatcher ────────────────────────────────────────
// Central hub that routes notifications to WhatsApp and/or Telegram
// based on which platforms are configured.

import { whatsappClient } from './whatsapp.js';
import { telegramBot } from './telegram.js';
import { config } from '../config.js';
import type { TaskRow } from '../services/task-service.js';
import type { PlanRow } from '../services/plan-service.js';

// ─── Types ──────────────────────────────────────────────────────────

export type NotificationType =
  | 'plan_ready'
  | 'review_ready'
  | 'agent_question'
  | 'task_errored'
  | 'merge_completed';

interface DiffData {
  additions: number;
  deletions: number;
  files_changed: unknown[];
}

interface ExtraData {
  plan?: PlanRow;
  diff?: DiffData;
  question?: string;
  error?: string;
}

// ─── Formatting ─────────────────────────────────────────────────────

/**
 * Format a notification message string for a given type.
 * Used for logging / fallback; the individual platform clients
 * use their own formatting for richer presentation.
 */
export function formatNotification(
  type: NotificationType,
  task: TaskRow,
  extraData?: ExtraData,
): string {
  switch (type) {
    case 'plan_ready': {
      const plan = extraData?.plan;
      const contentPreview = (plan?.content || '').slice(0, 200);
      const fileCount = Array.isArray(plan?.file_manifest) ? plan.file_manifest.length : 0;
      return [
        `\u{1F4CB} *Plan Ready*`,
        task.title,
        '',
        `Approach: ${contentPreview}${(plan?.content.length ?? 0) > 200 ? '...' : ''}`,
        `Files: ${fileCount} files`,
        '',
        'Reply APPROVE or REJECT [feedback]',
      ].join('\n');
    }

    case 'review_ready': {
      const diff = extraData?.diff;
      return [
        `\u{1F50D} *Review Ready*`,
        task.title,
        '',
        `+${diff?.additions ?? 0} \u2212${diff?.deletions ?? 0} across ${diff?.files_changed?.length ?? 0} files`,
        '',
        `Reply MERGE, REJECT, or view at ${config.dashboardUrl}/tasks/${task.id}`,
      ].join('\n');
    }

    case 'agent_question': {
      return [
        `\u2753 *Agent Question*`,
        task.title,
        '',
        extraData?.question || '',
        '',
        'Reply with your answer.',
      ].join('\n');
    }

    case 'task_errored': {
      return [
        `\u274C *Task Failed*`,
        task.title,
        '',
        extraData?.error || 'Unknown error',
      ].join('\n');
    }

    case 'merge_completed': {
      const diff = extraData?.diff;
      return [
        `\u2705 *Merged*`,
        task.title,
        '',
        `+${diff?.additions ?? 0} \u2212${diff?.deletions ?? 0} merged to ${task.target_branch}`,
      ].join('\n');
    }
  }
}

// ─── Dispatch ───────────────────────────────────────────────────────

/**
 * Send a notification to all configured messaging platforms.
 * Silently skips platforms that are not configured.
 * Never throws — errors are logged but do not propagate.
 */
export async function sendNotification(
  type: NotificationType,
  task: TaskRow,
  extraData?: ExtraData,
): Promise<void> {
  const promises: Promise<void>[] = [];

  // ── WhatsApp ────────────────────────────────────────────────────
  if (whatsappClient.isConfigured()) {
    const waPromise = (async () => {
      try {
        switch (type) {
          case 'plan_ready':
            if (extraData?.plan) {
              await whatsappClient.sendPlanNotification(task, extraData.plan);
            }
            break;
          case 'review_ready':
            if (extraData?.diff) {
              await whatsappClient.sendReviewNotification(task, extraData.diff);
            }
            break;
          case 'agent_question':
            if (extraData?.question) {
              await whatsappClient.sendQuestionNotification(task, extraData.question);
            }
            break;
          case 'task_errored':
            await whatsappClient.sendErrorNotification(task, extraData?.error || 'Unknown error');
            break;
          case 'merge_completed':
            if (extraData?.diff) {
              await whatsappClient.sendMergeNotification(task, extraData.diff);
            }
            break;
        }
      } catch (err) {
        console.error(`WhatsApp notification (${type}) failed:`, err);
      }
    })();
    promises.push(waPromise);
  }

  // ── Telegram ────────────────────────────────────────────────────
  if (telegramBot.isConfigured()) {
    const tgPromise = (async () => {
      try {
        switch (type) {
          case 'plan_ready':
            if (extraData?.plan) {
              await telegramBot.sendPlanNotification(task, extraData.plan);
            }
            break;
          case 'review_ready':
            if (extraData?.diff) {
              await telegramBot.sendReviewNotification(task, extraData.diff);
            }
            break;
          case 'agent_question':
            if (extraData?.question) {
              await telegramBot.sendQuestionNotification(task, extraData.question);
            }
            break;
          case 'task_errored':
            await telegramBot.sendErrorNotification(task, extraData?.error || 'Unknown error');
            break;
          case 'merge_completed':
            if (extraData?.diff) {
              await telegramBot.sendMergeNotification(task, extraData.diff);
            }
            break;
        }
      } catch (err) {
        console.error(`Telegram notification (${type}) failed:`, err);
      }
    })();
    promises.push(tgPromise);
  }

  // Fire all in parallel, swallow errors (already caught per-platform above)
  await Promise.allSettled(promises);
}

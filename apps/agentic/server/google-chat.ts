import { createLogger } from "./_core/logger";

const log = createLogger("google-chat");
const BASE_URL = process.env.BASE_URL || "http://localhost:9001";

function parseWebhookMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key.trim(), String(value || "").trim()])
        .filter(([, value]) => value.length > 0)
    );
  } catch (err) {
    log.warn({ err }, "Invalid GOOGLE_CHAT_REVIEW_REMINDER_WEBHOOKS JSON");
    return {};
  }
}

function getReviewReminderWebhook(streamId?: string | null): string | null {
  const normalizedStreamId = streamId?.trim();
  const webhookMap = parseWebhookMap(
    process.env.GOOGLE_CHAT_REVIEW_REMINDER_WEBHOOKS
  );
  if (normalizedStreamId && webhookMap[normalizedStreamId]) {
    return webhookMap[normalizedStreamId]!;
  }

  return (
    process.env.GOOGLE_CHAT_REVIEW_REMINDER_WEBHOOK_URL ||
    process.env.GOOGLE_CHAT_WEBHOOK_URL ||
    null
  );
}

function normalizeLine(value: string | undefined | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function buildReviewReminderText(params: {
  documentTitle: string;
  remindedBy: string;
  assigneeLabel?: string;
  message?: string;
  sourceRef?: string;
  streamLabel?: string;
  reviewUrl?: string;
}): string {
  const reviewUrl = params.reviewUrl || `${BASE_URL}/knowledge`;
  const lines = [
    "Review reminder",
    `Document: ${normalizeLine(params.documentTitle) || "Untitled"}`,
    params.streamLabel
      ? `Value stream: ${normalizeLine(params.streamLabel)}`
      : null,
    params.assigneeLabel
      ? `Assigned reviewer: ${normalizeLine(params.assigneeLabel)}`
      : null,
    `Requested by: ${normalizeLine(params.remindedBy) || "Knowledge curator"}`,
    params.message ? `Note: ${normalizeLine(params.message)}` : null,
    params.sourceRef ? `Source: ${normalizeLine(params.sourceRef)}` : null,
    `Open review queue: ${reviewUrl}`,
  ];

  return lines.filter((line): line is string => !!line).join("\n");
}

export async function sendReviewReminderGoogleChat(params: {
  documentTitle: string;
  remindedBy: string;
  assigneeLabel?: string;
  message?: string;
  sourceRef?: string;
  streamId?: string | null;
  streamLabel?: string;
  reviewUrl?: string;
}): Promise<boolean> {
  const webhookUrl = getReviewReminderWebhook(params.streamId);
  if (!webhookUrl) {
    log.info(
      { streamId: params.streamId || null },
      "Google Chat webhook not configured for review reminders"
    );
    return false;
  }

  const text = buildReviewReminderText(params);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      log.warn(
        { status: response.status, detail, streamId: params.streamId || null },
        "Google Chat review reminder failed"
      );
      return false;
    }

    log.info(
      { streamId: params.streamId || null },
      "Google Chat review reminder sent"
    );
    return true;
  } catch (err) {
    log.error(
      { err, streamId: params.streamId || null },
      "Google Chat review reminder errored"
    );
    return false;
  }
}

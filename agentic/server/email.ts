/**
 * Email service for invite and access request notifications.
 *
 * Transport:
 *   - Production: SMTP relay (SMTP_HOST env var)
 *   - Development: Logs email to console (no external dependency)
 *
 * Environment variables:
 *   SMTP_HOST     — SMTP server hostname (e.g. smtp-relay.gmail.com)
 *   SMTP_PORT     — SMTP port (default: 587)
 *   SMTP_USER     — SMTP username (optional, for authenticated relay)
 *   SMTP_PASS     — SMTP password (optional)
 *   EMAIL_FROM    — Sender address (default: noreply@hki.com)
 *   EMAIL_ENABLED — Set to "true" to enable SMTP delivery
 *   BASE_URL      — App base URL for building invite links
 */

import { createLogger } from "./_core/logger";

const log = createLogger("email");

// ── Configuration ───────────────────────────────────────────────────────────

const EMAIL_FROM = process.env.EMAIL_FROM || "AI Platform <noreply@hki.com>";
const BASE_URL = process.env.BASE_URL || "http://localhost:9001";
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === "true";

// Simple SMTP sender using built-in net module — zero external deps.
// Falls back to console logging when SMTP is not configured.

interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  secure?: boolean;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return {
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    secure: process.env.SMTP_SECURE === "true",
  };
}

// ── Minimal SMTP client (no external deps) ──────────────────────────────────

async function sendViaSMTP(
  smtp: SmtpConfig,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  // Dynamic import to avoid loading net in test/browser contexts
  const net = await import("net");
  const tls = await import("tls");

  return new Promise((resolve, reject) => {
    const timeout = 15_000;
    let socket: any;

    function connect() {
      if (smtp.secure) {
        socket = tls.connect(
          { host: smtp.host, port: smtp.port, rejectUnauthorized: true },
          () => handleGreeting()
        );
      } else {
        socket = net.createConnection(
          { host: smtp.host, port: smtp.port },
          () => handleGreeting()
        );
      }
      socket.setTimeout(timeout);
      socket.on("error", (err: Error) => reject(err));
      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("SMTP connection timeout"));
      });
    }

    const lines: string[] = [];
    let step = 0;

    const commands = [
      `EHLO ${smtp.host}`,
      // Auth commands are spliced in below if credentials provided
      `MAIL FROM:<${EMAIL_FROM.replace(/.*</, "").replace(/>.*/, "")}>`,
      `RCPT TO:<${to}>`,
      "DATA",
      // Message body handled separately
    ];

    // Insert AUTH LOGIN if credentials provided
    if (smtp.user && smtp.pass) {
      commands.splice(1, 0, "AUTH LOGIN");
      commands.splice(2, 0, Buffer.from(smtp.user).toString("base64"));
      commands.splice(3, 0, Buffer.from(smtp.pass).toString("base64"));
    }

    function handleGreeting() {
      // Wait for server greeting then start command sequence
    }

    let buffer = "";
    socket?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const parts = buffer.split("\r\n");
      buffer = parts.pop() || "";
      for (const line of parts) {
        lines.push(line);
        const code = parseInt(line.slice(0, 3), 10);
        // Multi-line responses: line[3] === '-' means more lines coming
        if (line[3] === "-") continue;

        if (code >= 400) {
          socket.end();
          reject(new Error(`SMTP error ${code}: ${line}`));
          return;
        }

        if (step < commands.length) {
          socket.write(commands[step] + "\r\n");
          step++;
        } else if (step === commands.length) {
          // Send message body
          const boundary = `----=_Part_${Date.now()}`;
          const msg = [
            `From: ${EMAIL_FROM}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            ``,
            `--${boundary}`,
            `Content-Type: text/html; charset=utf-8`,
            `Content-Transfer-Encoding: 7bit`,
            ``,
            html,
            ``,
            `--${boundary}--`,
            `.`,
          ].join("\r\n");
          socket.write(msg + "\r\n");
          step++;
        } else {
          socket.write("QUIT\r\n");
          socket.end();
          resolve();
        }
      }
    });

    connect();
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  if (!EMAIL_ENABLED) {
    log.info(
      { to: opts.to, subject: opts.subject },
      "Email delivery disabled by EMAIL_ENABLED flag"
    );
    if (process.env.NODE_ENV !== "production") {
      log.debug({ html: opts.html.slice(0, 500) }, "Email body preview");
    }
    return true;
  }

  const smtp = getSmtpConfig();
  if (!smtp) {
    log.warn(
      { to: opts.to },
      "SMTP not configured (SMTP_HOST missing) — email not sent"
    );
    return false;
  }

  try {
    await sendViaSMTP(smtp, opts.to, opts.subject, opts.html);
    log.info({ to: opts.to, subject: opts.subject }, "Email sent successfully");
    return true;
  } catch (err) {
    log.error(
      { to: opts.to, error: (err as Error).message },
      "Failed to send email"
    );
    return false;
  }
}

// ── Email Templates ─────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#0066B2;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
            HKI AI Platform
          </h1>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:32px;">${content}</td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
            This is an automated message from the HKI Innovation Lab AI Platform.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send an invite email with the access code and join link.
 */
export async function sendInviteEmail(params: {
  to: string;
  inviteCode: string;
  streamName: string;
  role: string;
  inviterName?: string;
  expiresAt?: string;
  note?: string;
}): Promise<boolean> {
  const joinUrl = `${BASE_URL}/knowledge/join?code=${encodeURIComponent(params.inviteCode)}`;

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#18181b;">
      You're invited to a Knowledge Base
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:1.6;">
      ${params.inviterName ? `<strong>${escapeHtml(params.inviterName)}</strong> has invited you` : "You've been invited"}
      to join the <strong>${escapeHtml(params.streamName)}</strong> knowledge base
      as a <strong>${escapeHtml(params.role)}</strong>.
    </p>
    ${params.note ? `<div style="margin:0 0 24px;padding:12px 16px;background:#f0f9ff;border-left:3px solid #0066B2;border-radius:4px;font-size:13px;color:#334155;">${escapeHtml(params.note)}</div>` : ""}
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${joinUrl}" style="display:inline-block;padding:12px 32px;background:#0066B2;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Join Knowledge Base
      </a>
    </div>
    <div style="text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#71717a;">Or enter this code manually:</p>
      <code style="display:inline-block;padding:8px 20px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;font-size:20px;font-weight:700;letter-spacing:3px;color:#18181b;">
        ${escapeHtml(params.inviteCode)}
      </code>
    </div>
    ${params.expiresAt ? `<p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">This invite expires on ${new Date(params.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>` : ""}
  `);

  return sendEmail({
    to: params.to,
    subject: `You're invited to the ${params.streamName} Knowledge Base`,
    html,
  });
}

/**
 * Notify a user that their access request was approved (with invite code).
 */
export async function sendAccessApprovedEmail(params: {
  to: string;
  inviteCode: string;
  streamName: string;
  role: string;
  note?: string;
}): Promise<boolean> {
  const joinUrl = `${BASE_URL}/knowledge/join?code=${encodeURIComponent(params.inviteCode)}`;

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#18181b;">
      Your access request was approved
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:1.6;">
      Your request to join the <strong>${escapeHtml(params.streamName)}</strong> knowledge base
      has been approved. You've been granted <strong>${escapeHtml(params.role)}</strong> access.
    </p>
    ${params.note ? `<div style="margin:0 0 24px;padding:12px 16px;background:#f0f9ff;border-left:3px solid #0066B2;border-radius:4px;font-size:13px;color:#334155;">${escapeHtml(params.note)}</div>` : ""}
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${joinUrl}" style="display:inline-block;padding:12px 32px;background:#0066B2;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Accept &amp; Join
      </a>
    </div>
    <div style="text-align:center;margin:0 0 16px;">
      <p style="margin:0 0 4px;font-size:12px;color:#71717a;">Your invite code:</p>
      <code style="display:inline-block;padding:8px 20px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;font-size:20px;font-weight:700;letter-spacing:3px;color:#18181b;">
        ${escapeHtml(params.inviteCode)}
      </code>
    </div>
  `);

  return sendEmail({
    to: params.to,
    subject: `Access approved — ${params.streamName} Knowledge Base`,
    html,
  });
}

/**
 * Notify a user that their access request was denied.
 */
export async function sendAccessDeniedEmail(params: {
  to: string;
  streamName: string;
  note?: string;
}): Promise<boolean> {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#18181b;">
      Access request update
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:1.6;">
      Your request to join the <strong>${escapeHtml(params.streamName)}</strong> knowledge base
      was not approved at this time.
    </p>
    ${params.note ? `<div style="margin:0 0 24px;padding:12px 16px;background:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;font-size:13px;color:#334155;">${escapeHtml(params.note)}</div>` : ""}
    <p style="margin:0;font-size:13px;color:#71717a;">
      If you believe this was a mistake, please contact your manager or the knowledge base admin.
    </p>
  `);

  return sendEmail({
    to: params.to,
    subject: `Access request update — ${params.streamName}`,
    html,
  });
}

/**
 * Notify a KB reviewer that a new access request is waiting for review.
 */
export async function sendAccessRequestSubmittedEmail(params: {
  to: string;
  reviewerName?: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  streamName?: string;
  justification: string;
  managerEmail?: string;
  reviewUrl?: string;
}): Promise<boolean> {
  const reviewUrl = params.reviewUrl || `${BASE_URL}/knowledge`;
  const requestedScope = params.streamName || "Not specified";

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#18181b;">
      New access request
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:1.6;">
      ${params.reviewerName ? `Hello ${escapeHtml(params.reviewerName)},` : "A new request"}
      needs review for the Knowledge Base workspace.
    </p>
    <div style="margin:0 0 20px;padding:14px 16px;background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;">
      <p style="margin:0 0 8px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.04em;">Requester</p>
      <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">
        ${escapeHtml(params.requesterName)}
      </p>
      <p style="margin:6px 0 0;font-size:13px;color:#52525b;line-height:1.5;">
        ${escapeHtml(params.requesterEmail)}<br />
        Department: ${escapeHtml(params.department)}<br />
        Requested stream: ${escapeHtml(requestedScope)}
        ${params.managerEmail ? `<br />Manager: ${escapeHtml(params.managerEmail)}` : ""}
      </p>
    </div>
    <div style="margin:0 0 24px;padding:14px 16px;background:#f8fafc;border-left:3px solid #0066B2;border-radius:6px;">
      <p style="margin:0 0 8px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.04em;">Business justification</p>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">
        ${escapeHtml(params.justification)}
      </p>
    </div>
    <div style="text-align:center;margin:0 0 20px;">
      <a href="${escapeHtml(reviewUrl)}" style="display:inline-block;padding:12px 32px;background:#0066B2;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Review access requests
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">
      Open the Knowledge Base and review this request from the Team &amp; Access section.
    </p>
  `);

  return sendEmail({
    to: params.to,
    subject: params.streamName
      ? `New knowledge access request — ${params.streamName}`
      : "New knowledge access request",
    html,
  });
}

/**
 * Notify an assigned reviewer that a follow-up reminder was sent.
 */
export async function sendReviewReminderEmail(params: {
  to: string;
  documentTitle: string;
  remindedBy: string;
  assigneeLabel?: string;
  message?: string;
  sourceRef?: string;
  reviewUrl?: string;
}): Promise<boolean> {
  const reviewUrl = params.reviewUrl || `${BASE_URL}/knowledge`;

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#18181b;">
      Review reminder
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:1.6;">
      A follow-up reminder was recorded for the review item
      <strong>${escapeHtml(params.documentTitle)}</strong>.
    </p>
    <div style="margin:0 0 20px;padding:14px 16px;background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;">
      <p style="margin:0 0 8px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.04em;">Assigned reviewer</p>
      <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">
        ${escapeHtml(params.assigneeLabel || params.to)}
      </p>
    </div>
    <p style="margin:0 0 20px;font-size:14px;color:#52525b;line-height:1.6;">
      Requested by <strong>${escapeHtml(params.remindedBy)}</strong>.
    </p>
    ${params.message ? `<div style="margin:0 0 24px;padding:12px 16px;background:#f0f9ff;border-left:3px solid #0066B2;border-radius:4px;font-size:13px;color:#334155;line-height:1.6;">${escapeHtml(params.message)}</div>` : ""}
    <div style="text-align:center;margin:0 0 20px;">
      <a href="${escapeHtml(reviewUrl)}" style="display:inline-block;padding:12px 32px;background:#0066B2;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Open Review Queue
      </a>
    </div>
    ${params.sourceRef ? `<p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">Source reference: ${escapeHtml(params.sourceRef)}</p>` : ""}
  `);

  return sendEmail({
    to: params.to,
    subject: `Review reminder — ${params.documentTitle}`,
    html,
  });
}

// ── Utility ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

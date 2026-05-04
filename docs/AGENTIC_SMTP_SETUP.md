# Agentic SMTP Setup

## Purpose

Agentic uses the existing Google identity provider for sign-in.
Invite delivery and access-review notifications are a separate concern and use
an SMTP relay, not Google OAuth or IAP directly.

## Recommended Approach

Use Google Workspace SMTP relay for outbound email from
`AI Platform <noreply@hki.com>`.

Why this is the preferred path:

- Reuses the current Google ecosystem already in place for auth.
- Avoids introducing another email vendor unless policy requires one.
- Fits the current backend implementation, which already expects SMTP.

## What Already Exists

- Google OAuth / IAP for authentication
- `agentic-bff-sa@p-642-cilab-demo.iam.gserviceaccount.com`
- Secret Manager integration for Agentic runtime secrets
- SMTP-based email sender in `apps/ai-platform/agentic/server/email.ts`

## What Must Be Provisioned

Google Workspace Admin Console:

1. Configure an SMTP relay service for Agentic.
2. Approve the sender identity, for example `noreply@hki.com`.
3. Choose one relay mode:
   - Authenticated relay using SMTP username/password
   - IP-allowlisted relay using the cluster egress IP/NAT IP
4. Ensure SPF, DKIM, and DMARC for the sender domain are handled by mail admins.

Google Cloud Secret Manager:

Create these secrets in `p-642-cilab-demo`:

```bash
gcloud secrets create agentic-smtp-host --replication-policy="automatic"
gcloud secrets create agentic-smtp-port --replication-policy="automatic"
gcloud secrets create agentic-smtp-user --replication-policy="automatic"
gcloud secrets create agentic-smtp-pass --replication-policy="automatic"
gcloud secrets create agentic-smtp-secure --replication-policy="automatic"
gcloud secrets create agentic-email-from --replication-policy="automatic"
gcloud secrets create agentic-email-enabled --replication-policy="automatic"
```

Populate them with values similar to:

```bash
printf 'smtp-relay.gmail.com' | gcloud secrets versions add agentic-smtp-host --data-file=- --project=p-642-cilab-demo
printf '587' | gcloud secrets versions add agentic-smtp-port --data-file=- --project=p-642-cilab-demo
printf 'false' | gcloud secrets versions add agentic-smtp-secure --data-file=- --project=p-642-cilab-demo
printf 'AI Platform <noreply@hki.com>' | gcloud secrets versions add agentic-email-from --data-file=- --project=p-642-cilab-demo
printf 'false' | gcloud secrets versions add agentic-email-enabled --data-file=- --project=p-642-cilab-demo
```

If Workspace requires authenticated relay, also add:

```bash
printf 'smtp-user-or-service-account' | gcloud secrets versions add agentic-smtp-user --data-file=- --project=p-642-cilab-demo
printf 'smtp-password' | gcloud secrets versions add agentic-smtp-pass --data-file=- --project=p-642-cilab-demo
```

Only switch `agentic-email-enabled` to `true` after the relay is verified.

## Deployment Wiring

The GKE sync script now maps these secrets into `agentic-bff-secrets`:

- `agentic-smtp-host` → `SMTP_HOST`
- `agentic-smtp-port` → `SMTP_PORT`
- `agentic-smtp-user` → `SMTP_USER`
- `agentic-smtp-pass` → `SMTP_PASS`
- `agentic-smtp-secure` → `SMTP_SECURE`
- `agentic-email-from` → `EMAIL_FROM`
- `agentic-email-enabled` → `EMAIL_ENABLED`

No application code changes are needed once those values are present.

## Verification

After secrets are populated and synced, verify inside the running pod:

```bash
kubectl exec -n platform deploy/agentic-bff -c agentic-bff -- /bin/sh -lc 'env | egrep "^(SMTP_|EMAIL_)" | sort'
```

Expected result:

- `SMTP_HOST` is set
- `SMTP_PORT` is set
- `EMAIL_FROM` is set
- `EMAIL_ENABLED=true`

## Operational Notes

- If `SMTP_HOST` is missing, Agentic will still create invites, but delivery will
  not occur.
- Startup logs now emit a warning when invite and access-review email delivery is
  not configured.
- Keep identity and email separate: Google OAuth/IAP remains the identity layer,
  while Workspace SMTP relay handles notification delivery.

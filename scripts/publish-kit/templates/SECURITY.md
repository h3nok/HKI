# Security Policy

## Reporting a vulnerability

If you discover a security issue in HKI, **please do not open a public
GitHub issue.** Instead, email **security@open-hki.dev** with:

- A description of the issue
- Steps to reproduce (or a minimal proof of concept)
- The affected package(s) and version(s)
- Your name and (optionally) GitHub handle so we can credit you

We will acknowledge receipt within 72 hours and aim to ship a fix or
mitigation within 14 days for high-severity issues.

## Scope

In scope:

- All packages under [`packages/`](./packages/) in this repository.
- The conformance test cases in
  [`packages/hki-conformance`](./packages/hki-conformance/).
- The audit scripts under [`scripts/`](./scripts/).

Out of scope:

- Vulnerabilities in third-party frameworks (LangChain, ADK, etc.) —
  please report those upstream. We will treat HKI bypasses caused by
  upstream changes as in-scope and patch the relevant adapter.

## Disclosure

We follow coordinated disclosure. Once a fix is shipped, we publish a
GitHub Security Advisory describing the issue, the affected versions,
and the mitigation.

## Threat model

The threats HKI is designed to block are catalogued in
[`docs/HKI_THREATS.md`](./docs/HKI_THREATS.md). Each threat has a
runnable demo under [`examples/threats/`](./examples/threats/). If you
find a threat that HKI fails to block (or blocks incorrectly), that is
a security issue and qualifies for the disclosure process above.

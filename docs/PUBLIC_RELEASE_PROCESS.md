# HKI Public Release Process

Status: release process for the public `open-hki/hki` standard repository.

HKI has three separate release tracks. Keep them separate so the public standard
can move quickly without exposing private platform deployment details.

## 1. Required Source CI

The source repository CI runs on pull requests and pushes to `main`:

- formatting and linting
- TypeScript typecheck and tests
- Python runtime, adapter, integration, and threat tests
- HKI AST audits and conformance suite
- mock HTTP probe smoke evidence
- strict service evidence bundle
- public release artifact materialization and audit

The final `hki-gate` job fails if any required gate fails. The public artifact
gate materializes the generated public repo, installs it with the generated
lockfile, and runs `pnpm audit:public-release` inside that generated repo.

## 2. Public Release Preview

`.github/workflows/public-release.yml` is the public artifact preview pipeline.
It runs on public-surface changes and can also be run manually.

The preview job:

1. checks the public release audit script syntax
2. renders the reference Kubernetes starter when `kubectl` is available
3. materializes the public repo with `scripts/publish-kit/publish-hki-public.sh`
4. installs the generated repo with `pnpm install --frozen-lockfile --ignore-scripts`
5. runs `pnpm audit:public-release`
6. builds the generated TypeScript packages
7. runs generated conformance verification
8. builds the generated `conformance.json`
9. runs the generated end-to-end demo
10. uploads the generated repo, evidence registry, and rendered K8s starter

This is the main answer to: "Can we safely open source this standard?" If this
job is red, the public artifact is not release-ready.

## 3. Public Repo Review Branch

The public release workflow has a manual `workflow_dispatch` option to push the
generated public repo to a review branch in `open-hki/hki`.

Required secret:

- `OPEN_HKI_DEPLOY_KEY` - SSH deploy key with write access to the public repo.

Default remote:

```text
git@github.com:open-hki/hki.git
```

Default branch:

```text
public-release-<short-sha>
```

The workflow intentionally pushes a review branch instead of force-pushing
`main`. Open a PR in the public repo from that branch, review the generated
diff, then merge normally.

## 4. Framework Package Release

`.github/workflows/framework-release.yml` publishes TypeScript framework
packages through Changesets.

Required secret:

- `NPM_TOKEN` - npm publish token for the HKI packages.

Release preflight includes:

- `pnpm build:framework`
- `pnpm audit:hki`
- `pnpm verify:hki-conformance`
- public repo materialization, install, and `pnpm audit:public-release`

If the public standard artifact is broken, package publication stops before the
Changesets publish step.

The generated public repo also ships a public-safe TypeScript release workflow.
It publishes from the public repo without depending on the private publish kit.

## 5. Live Evidence Release

`.github/workflows/probe-deploy.yml` deploys the probe target and runs live HTTP
HKI probes. This is the path toward stronger evidence profiles.

Required secrets:

- `WIF_PROVIDER`
- `WIF_SERVICE_ACCOUNT`
- `GKE_PROJECT_ID`

The workflow uploads an HTTP evidence bundle. Use that evidence with
`scripts/build-conformance-registry.mjs` when preparing release evidence.

## 6. Private Platform Deployment

`.github/workflows/services-deploy.yml` is internal CD for the private reference
platform. It is not part of the public standard release.

Required secrets include the GCP WIF and cluster values used by the private GKE
environment. Do not copy this deployment surface into the public repo.

## 7. Python Package Release

`.github/workflows/python-release.yml` builds Python source distributions and
wheels for:

- `hki-runtime`
- `hki-conformance`
- `hki-litellm`
- `hki-langchain`
- `hki-llamaindex`
- `hki-adk`
- `hki-autogen`
- `hki-crewai`

The workflow always builds and runs `twine check`. Publication is manual through
`workflow_dispatch` and can target TestPyPI or PyPI. Configure PyPI trusted
publishing for the repository before setting `publish=true`.

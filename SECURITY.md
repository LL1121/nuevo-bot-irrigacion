# Security Report & Recommended Actions

This document summarizes actions taken and recommended next steps to improve security before production.

## Actions performed

- Updated `.env.example` to include `WEBHOOK_APP_SECRET`, `SENTRY_DSN`, and `REDIS_URL`.
- Added optional Sentry initialization in `src/index.js` (enabled when `SENTRY_DSN` is set).
- Created GitHub Actions CI workflow at `.github/workflows/ci.yml` to run a security smoke test (`scripts/test_security.js`).
- Added `docker-compose.yml` with `redis` (and optional `mysql`) for local testing.
- Removed `mysqldump` package (unused) to eliminate critical vulnerabilities caused by nested `mysql2` versions.
- Ran `npm audit` and applied non-breaking fixes (`npm audit fix`).

## Current audit summary

- Total remaining vulnerabilities: 6
  - Critical: 0
  - High: 5
  - Low: 1

Files: `audit-current.json` and `audit-after-uninstall.json` contain the full reports.

Key remaining issues:
- `tar` (indirect) — high severity (affects `cacache`, `node-gyp`, `sqlite3`).
- `sqlite3` — high (used by `src/database/setup.js`).
- `node-gyp` / `make-fetch-happen` transitive issues.

## Recommended next steps

1. Review the `audit-after-uninstall.json` report and decide whether to run `npm audit fix --force`. This may introduce breaking changes; test in a branch.

2. If `sqlite3` is not needed in production, consider removing it; otherwise pin and test a version that addresses `tar` transitive vuln.

3. Use `npm ci` in CI to ensure reproducible installs and fail on vulnerabilities if desired.

4. For redis-backed rate limiting in production, run the `docker-compose.yml` locally and set `REDIS_URL` in environment.

5. Move secrets to GitHub Secrets / Vault. Set the following as repository secrets:
   - `WHATSAPP_TOKEN`
   - `WEBHOOK_APP_SECRET`
   - `SENTRY_DSN`

6. Add a `security` job in CI that fails on `high` or `critical` vulnerabilities (optional but recommended).

## Commands used

```bash
# Remove unused package
npm uninstall mysqldump

# Automatic non-breaking fixes
npm audit fix

# If you accept potential breaking changes (test carefully):
# npm audit fix --force
```

## Contact / Owner
- Repo owner: `lauti`
- For urgent security issues: rotate `WHATSAPP_TOKEN` and `WEBHOOK_APP_SECRET` in production immediately.

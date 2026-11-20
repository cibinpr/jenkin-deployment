# MyPanel – Specification (v0.1)

Give this file to your AI coding assistant at the start of every session.

## Goal
A self-hosted web hosting control panel: users, domains (Nginx vhosts), SSL (Let's Encrypt), file manager, server stats.

## Architecture
Browser → Nginx (HTTPS :8443) → **API** (Fastify, user `panel`, 127.0.0.1:8080)
→ Unix socket `/run/panel/helper.sock` → **Helper** (root, strict allow-list) → nginx / certbot / useradd / filesystem.

## Hard rules
1. The API NEVER runs as root and NEVER executes shell commands or touches site files directly.
2. The helper accepts ONLY actions defined in `packages/helper/src/validate.ts`. Every param is re-validated there (zod).
3. Use `execFile` with argument arrays (`packages/helper/src/exec.ts`). Never `exec`, never a shell string.
4. Every file path goes through `resolveInJail()`. Add tests for any new path-handling code.
5. Every privileged or mutating action writes to `audit_log`.
6. All request bodies/params/queries are validated with zod.
7. Never reload nginx without `nginx -t` passing first.

## Helper actions
`create_domain`, `remove_domain`, `issue_ssl`, `reload_nginx`, `fs_op` (list/read/write/mkdir/delete/rename).

## Data model
users, sessions, domains, audit_log (see `packages/api/src/db/index.ts`).

## Known gaps / TODO (in priority order)
1. Run `fs_op` in a child process dropped to the site user's uid/gid (removes TOCTOU risk entirely).
2. Per-user PHP-FPM pools (needed before hosting other people's sites).
3. File upload (multipart) + zip/unzip + chmod.
4. Monaco editor in the Files page.
5. SSL auto-renew status + expiry tracking in DB.
6. Admin UI: create/manage users, view audit log.
7. DNS editor, databases, backups, cron, email.
8. Panel self-update + backup/restore.
9. Integration tests for helper actions in a disposable container.

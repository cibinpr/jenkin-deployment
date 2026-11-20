# MyPanel

Node.js/TypeScript hosting control panel (domains, SSL, file manager, stats).

```
packages/
  api/      Fastify API (unprivileged)
  helper/   root daemon on a Unix socket (strict allow-list)
  web/      React + Vite frontend
templates/  nginx vhost templates
deploy/     systemd units + panel nginx config
install.sh  one-shot installer for Ubuntu 22.04/24.04
SPEC.md     rules + roadmap (give this to your AI assistant)
```

## Install on a fresh Ubuntu server
```bash
unzip mypanel.zip && cd mypanel
sudo ./install.sh
```
Then create the admin (command is printed at the end), and open `https://SERVER_IP:8443`.

## Local development (no root needed)
```bash
npm install
# terminal 1 – helper (dev mode, writes to local dirs; domain/user actions need root so mainly test fs/jail)
HELPER_ALLOW_NON_ROOT=1 HELPER_SOCKET=/tmp/panel/helper.sock npm run dev:helper
# terminal 2 – API
HELPER_SOCKET=/tmp/panel/helper.sock npm run dev:api
npm run create-admin -w @mypanel/api -- admin 'a-long-password'
# terminal 3 – UI (http://localhost:5173)
npm run dev:web
```
Run tests: `npm test`

## Status & warning
This is an **MVP scaffold**. Test on a throwaway VPS first. Read the "Known gaps" in `SPEC.md`
before hosting anyone else's sites. Domain DNS must point to the server before issuing SSL.

<!-- Auto-deploy test: 2026-11-20 17:33:50 -->

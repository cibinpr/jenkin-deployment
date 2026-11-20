#!/usr/bin/env bash
# MyPanel installer for Ubuntu 22.04/24.04. Run as root on a FRESH server.
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "Run as root"; exit 1; }
SRC="$(cd "$(dirname "$0")" && pwd)"
APP=/opt/mypanel

echo "==> Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx php-fpm certbot ufw fail2ban build-essential python3 curl openssl rsync

if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]]; then
  echo "==> Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> Creating panel user and directories"
getent group panel >/dev/null || groupadd --system panel
id panel >/dev/null 2>&1 || useradd --system --gid panel --home-dir /var/lib/mypanel --shell /usr/sbin/nologin panel
install -d -o panel -g panel -m 750 /var/lib/mypanel
install -d -m 750 /etc/mypanel/tls

echo "==> Copying application to $APP"
mkdir -p "$APP"
rsync -a --delete --exclude node_modules --exclude .git --exclude '*.db' "$SRC/" "$APP/"
cd "$APP"
npm install --no-audit --no-fund
npm run build

echo "==> Configuring nginx for the panel (port 8443)"
if [[ ! -f /etc/mypanel/tls/panel.crt ]]; then
  openssl req -x509 -nodes -newkey rsa:3072 -days 825 -subj "/CN=mypanel" \
    -keyout /etc/mypanel/tls/panel.key -out /etc/mypanel/tls/panel.crt
  chmod 600 /etc/mypanel/tls/panel.key
fi
cp deploy/panel-nginx.conf /etc/nginx/conf.d/mypanel.conf
nginx -t && systemctl reload nginx

echo "==> Installing systemd services"
cp deploy/panel-helper.service deploy/panel-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now panel-helper panel-api

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8443/tcp
ufw --force enable

cat <<MSG

MyPanel installed.
Create your admin account:
  cd $APP && sudo -u panel PANEL_DB=/var/lib/mypanel/panel.db \\
    node packages/api/dist/scripts/create-admin.js admin 'a-long-password' --totp
Then open: https://<server-ip>:8443
MSG

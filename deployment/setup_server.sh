#!/usr/bin/env bash
# ==============================================================================
# MyPanel - Initial Server Provisioning Script for Fresh Ubuntu EC2 (22.04 / 24.04)
# SRS Reference: Section 2.3, 6.3 & 7.2
# Run as root or with sudo: sudo ./setup_server.sh
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo " Starting MyPanel Fresh EC2 Provisioning"
echo "=========================================================="

export DEBIAN_FRONTEND=noninteractive

# 1. Update OS package cache and install prerequisites
echo "--> Updating package repositories..."
apt-get update -y
apt-get install -y --no-install-recommends \
    curl \
    git \
    rsync \
    tar \
    ufw \
    fail2ban \
    sqlite3 \
    nginx \
    certbot \
    python3-certbot-nginx \
    php-fpm \
    php-cli \
    php-mysql \
    php-sqlite3 \
    php-mbstring \
    php-xml \
    php-curl \
    ca-certificates \
    gnupg

# 2. Install Node.js 22 LTS (if installed version is < 22)
NODE_INSTALLED=0
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node -v | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -ge 22 ]; then
        NODE_INSTALLED=1
        echo "--> Node.js version $(node -v) is already installed."
    fi
fi

if [ "$NODE_INSTALLED" -eq 0 ]; then
    echo "--> Installing Node.js 22 LTS..."
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
    apt-get update -y
    apt-get install -y nodejs
    echo "--> Node.js installed: $(node -v)"
fi

# 3. Create unprivileged 'panel' system user
if ! id -u panel >/dev/null 2>&1; then
    echo "--> Creating unprivileged system user 'panel'..."
    useradd -r -s /usr/sbin/nologin -d /var/lib/mypanel -M panel
fi

# 4. Create deploy user for Jenkins / CI/CD if it doesn't exist
if ! id -u deploy >/dev/null 2>&1; then
    echo "--> Creating dedicated CI/CD 'deploy' user..."
    useradd -m -s /bin/bash deploy
    mkdir -p /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    touch /home/deploy/.ssh/authorized_keys
    chmod 600 /home/deploy/.ssh/authorized_keys
    chown -R deploy:deploy /home/deploy/.ssh
fi

# 5. Create required directories
echo "--> Creating application and runtime directories..."
mkdir -p /opt/mypanel
mkdir -p /var/lib/mypanel/acme-challenge
mkdir -p /etc/mypanel/tls
mkdir -p /run/panel
mkdir -p /var/backups/mypanel/releases
mkdir -p /var/backups/mypanel/data

chown -R panel:panel /var/lib/mypanel /run/panel
chmod 750 /var/lib/mypanel
chmod 755 /run/panel

# 6. Generate Self-Signed TLS certificate for MyPanel port 8443 if not present
if [ ! -f /etc/mypanel/tls/panel.crt ]; then
    echo "--> Generating self-signed TLS certificate for MyPanel on port 8443..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/mypanel/tls/panel.key \
        -out /etc/mypanel/tls/panel.crt \
        -subj "/C=US/ST=Cloud/L=Server/O=MyPanel/CN=mypanel"
    chmod 600 /etc/mypanel/tls/panel.key
    chmod 644 /etc/mypanel/tls/panel.crt
fi

# 7. Configure UFW Host Firewall (allow 22, 80, 443, 8443)
echo "--> Configuring UFW firewall rules..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP Website'
ufw allow 443/tcp comment 'HTTPS Website'
ufw allow 8443/tcp comment 'MyPanel HTTPS'
ufw --force enable

echo "=========================================================="
echo " EC2 Base Provisioning Completed Successfully!"
echo " Ready for MyPanel deployment to /opt/mypanel"
echo "=========================================================="

#!/usr/bin/env bash
# ==============================================================================
# MyPanel - Automated Production Deployment Script
# SRS Reference: Sections 6, 7 & 15
# Usage: sudo ./deploy.sh <release-tarball-path> <git-commit>
# ==============================================================================

set -euo pipefail

RELEASE_TARBALL="${1:-}"
COMMIT_HASH="${2:-unknown}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

APP_BASE="/opt"
APP_DIR="${APP_BASE}/mypanel"
BACKUP_DIR="/var/backups/mypanel/releases"
STATE_DIR="/var/lib/mypanel"
TLS_DIR="/etc/mypanel/tls"
SOCKET_DIR="/run/panel"

echo "======================================================"
echo " Starting MyPanel Deployment: Commit ${COMMIT_HASH}"
echo " Timestamp: ${TIMESTAMP}"
echo "======================================================"

if [[ -z "${RELEASE_TARBALL}" || ! -f "${RELEASE_TARBALL}" ]]; then
    echo "ERROR: Valid release package not found at '${RELEASE_TARBALL}'" >&2
    exit 1
fi

# Ensure required system users and directories exist
id -u panel >/dev/null 2>&1 || {
    echo "Creating system account 'panel'..."
    useradd -r -s /usr/sbin/nologin -d /var/lib/mypanel -M panel
}

mkdir -p "${BACKUP_DIR}" "${STATE_DIR}" "${TLS_DIR}" "${SOCKET_DIR}"
chown -R panel:panel "${STATE_DIR}" "${SOCKET_DIR}"
chmod 750 "${STATE_DIR}"
chmod 755 "${SOCKET_DIR}"

# 1. Backup current release for rollback capability
if [ -d "${APP_DIR}" ]; then
    echo "Backing up active release..."
    PREV_BACKUP="${BACKUP_DIR}/mypanel_prev_${TIMESTAMP}.tar.gz"
    tar -czf "${PREV_BACKUP}" -C "${APP_BASE}" mypanel
    echo "${PREV_BACKUP}" > "${BACKUP_DIR}/latest_rollback_archive.txt"
    echo "${COMMIT_HASH}" > "${BACKUP_DIR}/latest_deployed_commit.txt"
fi

# 2. Extract new release into temporary directory
STAGING_DIR="$(mktemp -d /tmp/mypanel_deploy_XXXXXX)"
echo "Extracting release to staging directory: ${STAGING_DIR}..."
tar -xzf "${RELEASE_TARBALL}" -C "${STAGING_DIR}"

# 3. Install production dependencies if needed
echo "Installing production node dependencies in staging..."
(cd "${STAGING_DIR}" && npm ci --omit=dev)

# 4. Atomic release cutover
echo "Applying update to ${APP_DIR}..."
mkdir -p "${APP_DIR}"
# Sync new files while preserving environment and local overrides if any
rsync -a --delete \
    --exclude='node_modules/.cache' \
    --exclude='.env' \
    "${STAGING_DIR}/" "${APP_DIR}/"

rm -rf "${STAGING_DIR}"
rm -f "${RELEASE_TARBALL}"

# 5. Set appropriate ownership and permissions
echo "Setting permissions..."
chown -R root:root "${APP_DIR}"
# Helper runs as root; API runs as panel
chown -R panel:panel "${APP_DIR}/packages/api" || true
chown -R panel:panel "${STATE_DIR}"

# 6. Install or update systemd service files if present
if [ -f "${APP_DIR}/deployment/panel-helper.service" ]; then
    cp "${APP_DIR}/deployment/panel-helper.service" /etc/systemd/system/
fi
if [ -f "${APP_DIR}/deployment/panel-api.service" ]; then
    cp "${APP_DIR}/deployment/panel-api.service" /etc/systemd/system/
fi

systemctl daemon-reload

# 7. Test Nginx configuration before reload
echo "Validating Nginx configuration..."
nginx -t || {
    echo "ERROR: Nginx configuration test failed!" >&2
    exit 1
}

# 8. Restart MyPanel services
echo "Restarting MyPanel systemd services..."
systemctl restart panel-helper
systemctl restart panel-api
systemctl reload nginx

# 9. Verify service health
echo "Verifying service states..."
sleep 2

systemctl is-active --quiet panel-helper || {
    echo "ERROR: panel-helper failed to start!" >&2
    exit 1
}

systemctl is-active --quiet panel-api || {
    echo "ERROR: panel-api failed to start!" >&2
    exit 1
}

# 10. Perform HTTP smoke test on internal port 8080
echo "Performing API health check on 127.0.0.1:8080..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/ || true)
if [[ "${HTTP_STATUS}" != "200" && "${HTTP_STATUS}" != "302" && "${HTTP_STATUS}" != "401" && "${HTTP_STATUS}" != "404" ]]; then
    echo "ERROR: API health check returned unexpected response: ${HTTP_STATUS}" >&2
    exit 1
fi

echo "======================================================"
echo " Deployment SUCCESSFUL for Commit ${COMMIT_HASH}"
echo "======================================================"

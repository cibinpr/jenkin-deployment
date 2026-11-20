#!/usr/bin/env bash
# ==============================================================================
# MyPanel - Automated Production Rollback Script
# SRS Reference: Sections 7.4 & 15.8
# Usage: sudo ./rollback.sh
# ==============================================================================

set -euo pipefail

APP_BASE="/opt"
APP_DIR="${APP_BASE}/mypanel"
BACKUP_DIR="/var/backups/mypanel/releases"
ROLLBACK_FILE="${BACKUP_DIR}/latest_rollback_archive.txt"

echo "======================================================"
echo " Initiating Automated Rollback for MyPanel"
echo "======================================================"

if [[ ! -f "${ROLLBACK_FILE}" ]]; then
    echo "ERROR: No recorded rollback archive found at ${ROLLBACK_FILE}" >&2
    exit 1
fi

ARCHIVE_PATH="$(cat "${ROLLBACK_FILE}")"

if [[ -z "${ARCHIVE_PATH}" || ! -f "${ARCHIVE_PATH}" ]]; then
    echo "ERROR: Rollback archive '${ARCHIVE_PATH}' does not exist!" >&2
    exit 1
fi

echo "Restoring previous release from archive: ${ARCHIVE_PATH}..."

# Stop services before restoring
systemctl stop panel-api || true
systemctl stop panel-helper || true

# Extract previous release
tar -xzf "${ARCHIVE_PATH}" -C "${APP_BASE}"

# Ensure permissions
chown -R root:root "${APP_DIR}"
chown -R panel:panel "${APP_DIR}/packages/api" || true

# Check Nginx config before reloading
nginx -t

# Restart services
systemctl daemon-reload
systemctl restart panel-helper
systemctl restart panel-api
systemctl reload nginx

# Verify health
sleep 2
systemctl is-active --quiet panel-helper || (echo "Rollback: panel-helper failed to start!" && exit 1)
systemctl is-active --quiet panel-api || (echo "Rollback: panel-api failed to start!" && exit 1)

echo "======================================================"
echo " Rollback completed successfully!"
echo "======================================================"

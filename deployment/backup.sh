#!/usr/bin/env bash
# ==============================================================================
# MyPanel - Server-Level Backup Script
# SRS Reference: Section 8 & Section 15.8
# Usage: sudo ./backup.sh [backup_tag]
# ==============================================================================

set -euo pipefail

TAG="${1:-manual_$(date +%Y%m%d_%H%M%S)}"
BACKUP_ROOT="/var/backups/mypanel/data"
TARGET_DIR="${BACKUP_ROOT}/${TAG}"

echo "Creating backup for tag: ${TAG}..."
mkdir -p "${TARGET_DIR}"

# 1. Backup SQLite database safely using sqlite3 if available, or file copy
DB_PATH="/var/lib/mypanel/panel.db"
if [ -f "${DB_PATH}" ]; then
    echo "Backing up SQLite database..."
    if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 "${DB_PATH}" ".backup '${TARGET_DIR}/panel.db'"
    else
        cp -p "${DB_PATH}" "${TARGET_DIR}/panel.db"
    fi
fi

# 2. Backup Nginx site configurations
if [ -d "/etc/nginx/sites-available" ]; then
    echo "Backing up Nginx configurations..."
    mkdir -p "${TARGET_DIR}/nginx"
    cp -rp /etc/nginx/sites-available "${TARGET_DIR}/nginx/" || true
    cp -rp /etc/nginx/sites-enabled "${TARGET_DIR}/nginx/" || true
fi

# 3. Backup Panel TLS and configuration
if [ -d "/etc/mypanel" ]; then
    echo "Backing up /etc/mypanel configuration and TLS material..."
    cp -rp /etc/mypanel "${TARGET_DIR}/" || true
fi

# 4. Backup Let's Encrypt certificates
if [ -d "/etc/letsencrypt" ]; then
    echo "Backing up Let's Encrypt certificates..."
    cp -rp /etc/letsencrypt "${TARGET_DIR}/" || true
fi

# 5. Compress and restrict permissions
ARCHIVE_NAME="${BACKUP_ROOT}/mypanel_backup_${TAG}.tar.gz"
tar -czf "${ARCHIVE_NAME}" -C "${BACKUP_ROOT}" "${TAG}"
rm -rf "${TARGET_DIR}"
chmod 600 "${ARCHIVE_NAME}"

# 6. Retention policy: Keep the last 14 backups
echo "Pruning backups older than 14 days..."
find "${BACKUP_ROOT}" -name "mypanel_backup_*.tar.gz" -mtime +14 -delete || true

echo "Backup created successfully at: ${ARCHIVE_NAME}"

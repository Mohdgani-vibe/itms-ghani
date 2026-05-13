#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
FRONTEND_DIST_DIR="$FRONTEND_DIR/dist"
TEMPLATE_PATH="$REPO_ROOT/deploy/nginx/itms.conf"
INSTALLER_SOURCE_DIR="$REPO_ROOT/scripts"

SITE_NAME="${SITE_NAME:-itms}"
SERVER_NAME="${SERVER_NAME:-}"
BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-127.0.0.1:3001}"
WWW_ROOT="${WWW_ROOT:-/var/www/itms}"
INSTALLERS_ROOT="${INSTALLERS_ROOT:-$WWW_ROOT/installers}"
AVAILABLE_PATH="/etc/nginx/sites-available/${SITE_NAME}"
ENABLED_PATH="/etc/nginx/sites-enabled/${SITE_NAME}"
BUILD_USER="${SUDO_USER:-${USER:-}}"
BUILD_GROUP=""
DRY_RUN=0

usage() {
	cat <<'EOF'
Usage:
	install-itms-nginx.sh [server-name] [--dry-run]
	install-itms-nginx.sh [--dry-run] [server-name]

Options:
	--dry-run   Print the actions that would be taken without changing the host
	--help      Show this message
EOF
}

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

run_privileged() {
	if [[ "$DRY_RUN" -eq 1 ]]; then
		printf '[dry-run]'
		printf ' %q' "$@"
		printf '\n'
		return 0
	fi

	if [[ "$EUID" -eq 0 ]]; then
		"$@"
	else
		sudo "$@"
	fi
}

run_as_build_user() {
	if [[ -z "$BUILD_USER" ]]; then
		echo "Unable to determine the non-root user for the frontend build." >&2
		exit 1
	fi

	if [[ "$DRY_RUN" -eq 1 ]]; then
		printf '[dry-run]'
		if [[ "$EUID" -eq 0 && -n "${SUDO_USER:-}" ]]; then
			printf ' %q' runuser -u "$BUILD_USER" -- "$@"
		else
			printf ' %q' "$@"
		fi
		printf '\n'
		return 0
	fi

	if [[ "$EUID" -eq 0 && -n "${SUDO_USER:-}" ]]; then
		runuser -u "$BUILD_USER" -- "$@"
	else
		"$@"
	fi
}

resolve_build_identity() {
	if [[ -z "$BUILD_USER" ]]; then
		echo "Unable to determine the non-root user for the frontend build." >&2
		exit 1
	fi

	BUILD_GROUP="$(id -gn "$BUILD_USER")"
}

escape_sed_replacement() {
	printf '%s' "$1" | sed 's/[\\&|]/\\&/g'
}

parse_args() {
	local positional=()

	while [[ $# -gt 0 ]]; do
		case "$1" in
			--dry-run)
				DRY_RUN=1
				shift
				;;
			--help|-h)
				usage
				exit 0
				;;
			--*)
				echo "Unknown argument: $1" >&2
				usage >&2
				exit 1
				;;
			*)
				positional+=("$1")
				shift
				;;
		esac
		done

	if [[ ${#positional[@]} -gt 1 ]]; then
		echo "Expected at most one positional server name." >&2
		usage >&2
		exit 1
	fi

	if [[ ${#positional[@]} -eq 1 && -z "${SERVER_NAME:-}" ]]; then
		SERVER_NAME="${positional[0]}"
	fi

	if [[ -z "$SERVER_NAME" ]]; then
		SERVER_NAME="YOUR_SERVER_IP"
	fi
}

require_command npm
require_command node
require_command sed
require_command mktemp
require_command id
if [[ "$EUID" -eq 0 && -n "${SUDO_USER:-}" ]]; then
	require_command runuser
fi

resolve_build_identity
parse_args "$@"

if [[ "$DRY_RUN" -eq 1 ]]; then
	echo "Running install-itms-nginx.sh in dry-run mode. No files or services will be changed."
fi

ensure_frontend_dependencies() {
	if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
		return 0
	fi

	echo "Frontend dependencies are missing. Installing them in $FRONTEND_DIR..."
	cd "$FRONTEND_DIR"
	run_as_build_user npm install
	cd "$REPO_ROOT"
}

missing_packages=()
if ! command -v nginx >/dev/null 2>&1; then
	missing_packages+=(nginx)
fi
if ! command -v rsync >/dev/null 2>&1; then
	missing_packages+=(rsync)
fi

if [[ ${#missing_packages[@]} -gt 0 ]]; then
	require_command apt-get
	echo "Installing required system packages: ${missing_packages[*]}"
	run_privileged apt-get update
	run_privileged apt-get install -y "${missing_packages[@]}"
fi

echo "Building frontend assets..."
ensure_frontend_dependencies
	if [[ -d "$FRONTEND_DIST_DIR" ]]; then
		run_privileged chown -R "$BUILD_USER:$BUILD_GROUP" "$FRONTEND_DIST_DIR"
	fi
cd "$FRONTEND_DIR"
run_as_build_user npm run build

if [[ ! -f "$FRONTEND_DIST_DIR/index.html" ]]; then
	echo "Expected frontend build output at $FRONTEND_DIST_DIR/index.html" >&2
	exit 1
fi

echo "Syncing frontend assets to $WWW_ROOT..."
	run_privileged mkdir -p "$WWW_ROOT"
	run_privileged rsync -a --delete "$FRONTEND_DIST_DIR/" "$WWW_ROOT/"

echo "Syncing installer assets to $INSTALLERS_ROOT..."
	run_privileged mkdir -p "$INSTALLERS_ROOT"
	run_privileged rsync -a --delete \
		"$INSTALLER_SOURCE_DIR/install-itms-agent.sh" \
		"$INSTALLER_SOURCE_DIR/install-itms-agent.ps1" \
		"$INSTALLER_SOURCE_DIR/push-system-inventory.py" \
		"$INSTALLER_SOURCE_DIR/push-system-inventory.ps1" \
		"$INSTALLERS_ROOT/"

server_name_escaped="$(escape_sed_replacement "$SERVER_NAME")"
www_root_escaped="$(escape_sed_replacement "$WWW_ROOT")"
backend_upstream_escaped="$(escape_sed_replacement "$BACKEND_UPSTREAM")"

tmp_config="$(mktemp)"
trap 'rm -f "$tmp_config"' EXIT
sed \
	-e "s|__SERVER_NAME__|$server_name_escaped|g" \
	-e "s|__WWW_ROOT__|$www_root_escaped|g" \
	-e "s|__BACKEND_UPSTREAM__|$backend_upstream_escaped|g" \
	"$TEMPLATE_PATH" > "$tmp_config"

echo "Installing nginx site config for $SERVER_NAME..."
	run_privileged cp "$tmp_config" "$AVAILABLE_PATH"
	run_privileged ln -sfn "$AVAILABLE_PATH" "$ENABLED_PATH"
	run_privileged rm -f /etc/nginx/sites-enabled/default

echo "Validating nginx configuration..."
	run_privileged nginx -t

echo "Enabling and restarting nginx..."
	run_privileged systemctl enable nginx
	run_privileged systemctl restart nginx

echo
echo "ITMS frontend is now served by nginx at http://$SERVER_NAME/login"
echo "nginx web root: $WWW_ROOT"
echo "backend upstream: $BACKEND_UPSTREAM"

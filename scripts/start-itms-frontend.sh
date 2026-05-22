#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PORT="${FRONTEND_PORT:-4175}"
FRONTEND_PUBLIC_HOST="${FRONTEND_PUBLIC_HOST:-${ITMS_PUBLIC_HOST:-}}"
FRONTEND_BACKGROUND="${FRONTEND_BACKGROUND:-0}"
RUN_DIR="$REPO_ROOT/.run"
PID_FILE="$RUN_DIR/frontend-preview.pid"
LOG_FILE="${FRONTEND_LOG_FILE:-$RUN_DIR/frontend-preview.log}"

if [[ -z "$FRONTEND_PUBLIC_HOST" ]]; then
	if [[ "$FRONTEND_HOST" == "0.0.0.0" ]]; then
		FRONTEND_PUBLIC_HOST="$(hostname -I 2>/dev/null | awk '{print $1}')"
	fi
	FRONTEND_PUBLIC_HOST="${FRONTEND_PUBLIC_HOST:-localhost}"
fi

FRONTEND_URL="${FRONTEND_URL:-http://${FRONTEND_PUBLIC_HOST}:${FRONTEND_PORT}}"

while [[ $# -gt 0 ]]; do
	case "$1" in
		--background)
			FRONTEND_BACKGROUND=1
			shift
			;;
		--foreground)
			FRONTEND_BACKGROUND=0
			shift
			;;
		*)
			echo "Unknown argument: $1" >&2
			exit 1
			;;
	esac
done

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Missing required command: $1" >&2
		exit 1
	fi
}

require_command curl
require_command node
require_command npm
require_command ss
require_command ps

ensure_frontend_dependencies() {
	if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
		return 0
	fi

	echo "Frontend dependencies are missing. Installing them in $FRONTEND_DIR..."
	cd "$FRONTEND_DIR"
	npm install
}

frontend_healthy() {
	curl -fsS -I "$FRONTEND_URL" >/dev/null 2>&1
}

wait_for_frontend() {
	local attempt
	for attempt in $(seq 1 20); do
		if frontend_healthy; then
			return 0
		fi
		sleep 1
	done
	return 1
}

find_frontend_pids() {
	ss -ltnp "( sport = :${FRONTEND_PORT} )" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u
}

kill_stale_frontend_processes() {
	local pid
	local cmdline

	while read -r pid; do
		[[ -z "$pid" ]] && continue
		cmdline="$(ps -p "$pid" -o args= 2>/dev/null || true)"
		[[ -z "$cmdline" ]] && continue

		if [[ "$cmdline" == *"vite/bin/vite.js preview"* ]] || [[ "$cmdline" == *"npm run preview"* ]]; then
			kill "$pid" 2>/dev/null || true
			sleep 1
			if ps -p "$pid" >/dev/null 2>&1; then
				kill -9 "$pid" 2>/dev/null || true
			fi
		fi
	done < <(find_frontend_pids)
}

port_in_use() {
	ss -ltn "( sport = :${FRONTEND_PORT} )" 2>/dev/null | grep -q ":${FRONTEND_PORT} "
}

if port_in_use; then
	if frontend_healthy; then
		echo "Frontend preview already healthy at $FRONTEND_URL"
		exit 0
	fi

	kill_stale_frontend_processes
	if port_in_use; then
		echo "Port ${FRONTEND_PORT} is in use by a non-preview process. Stop it or set FRONTEND_PORT to a free port." >&2
		exit 1
	fi
fi

cd "$FRONTEND_DIR"
ensure_frontend_dependencies

if [[ "$FRONTEND_BACKGROUND" == "1" ]]; then
	mkdir -p "$RUN_DIR"
	: > "$LOG_FILE"
	nohup node node_modules/vite/bin/vite.js preview --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" --strictPort >>"$LOG_FILE" 2>&1 < /dev/null &
	frontend_pid=$!
	echo "$frontend_pid" > "$PID_FILE"
	if ! wait_for_frontend; then
		echo "Frontend preview did not become healthy at $FRONTEND_URL" >&2
		if ps -p "$frontend_pid" >/dev/null 2>&1; then
			kill "$frontend_pid" 2>/dev/null || true
		fi
		rm -f "$PID_FILE"
		tail -n 40 "$LOG_FILE" >&2 || true
		exit 1
	fi
	echo "Frontend preview started in background at $FRONTEND_URL"
	echo "PID: $frontend_pid"
	echo "Log: $LOG_FILE"
	exit 0
fi

exec node node_modules/vite/bin/vite.js preview --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" --strictPort
#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=""
if declare -p BASH_SOURCE >/dev/null 2>&1 && [[ ${#BASH_SOURCE[@]} -gt 0 ]] && [[ -n "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
COLLECTOR_SOURCE_DEFAULT=""
if [[ -n "$SCRIPT_DIR" ]]; then
  COLLECTOR_SOURCE_DEFAULT="$SCRIPT_DIR/push-system-inventory.py"
fi
INSTALL_DIR="/opt/itms"
COLLECTOR_TARGET="$INSTALL_DIR/push-system-inventory.py"
ENV_FILE="/etc/itms-agent.env"
SYSTEMD_SERVICE="/etc/systemd/system/itms-inventory-refresh.service"
SYSTEMD_TIMER="/etc/systemd/system/itms-inventory-refresh.timer"
OPENSCAP_RUNNER="$INSTALL_DIR/run-openscap-scan.sh"
OPENSCAP_SERVICE="/etc/systemd/system/itms-openscap-scan.service"
OPENSCAP_TIMER="/etc/systemd/system/itms-openscap-scan.timer"
CLAMAV_SERVICE="/etc/systemd/system/itms-clamav-scan.service"
CLAMAV_TIMER="/etc/systemd/system/itms-clamav-scan.timer"

SERVER_URL=""
INGEST_TOKEN=""
INGEST_TOKEN_FILE=""
PROMPT_INGEST_TOKEN=0
CATEGORY="auto"
ASSIGNED_TO_EMAIL=""
ASSIGNED_TO_NAME=""
EMPLOYEE_CODE=""
DEPARTMENT_NAME=""
ASSET_TAG=""
ASSET_NAME=""
NOTES="Installed by ITMS bootstrap"
SALT_MASTER=""
WAZUH_MANAGER=""
WAZUH_GROUP="default"
REFRESH_HOURS="6"
COLLECTOR_URL=""
OPENSCAP_PROFILE="${ITMS_OPENSCAP_PROFILE:-auto}"
OPENSCAP_DATASTREAM=""
OPENSCAP_RESULTS_DIR="/var/lib/itms/openscap"
OPENSCAP_CONTENT_DIR="/var/lib/itms/openscap/content"
OPENSCAP_CONTENT_RELEASE="${ITMS_OPENSCAP_CONTENT_RELEASE:-v0.1.80}"
OPENSCAP_SCAN_HOURS="24"
CLAMAV_SCAN_PATHS="${ITMS_CLAMAV_SCAN_PATHS:-/home,/etc,/opt,/usr/local/bin,/usr/local/sbin}"
CLAMAV_TIMEOUT="${ITMS_CLAMAV_TIMEOUT:-7200}"
INCLUDE_OPENSCAP_REPORT="${ITMS_INCLUDE_OPENSCAP_REPORT:-true}"
USE_HARDINFO_FALLBACK="${ITMS_USE_HARDINFO_FALLBACK:-false}"
SALT_BOOTSTRAP_URL="${ITMS_SALT_BOOTSTRAP_URL:-https://github.com/saltstack/salt-bootstrap/releases/latest/download/bootstrap-salt.sh}"
SALT_BOOTSTRAP_VERSION="${ITMS_SALT_BOOTSTRAP_VERSION:-3006}"
REQUIRE_SALT="${ITMS_REQUIRE_SALT:-false}"

usage() {
  cat <<'EOF'
Usage:
  sudo ./scripts/install-itms-agent.sh --server-url http://itms.example.com:3001 --token-file /path/to/inventory-ingest-token [options]

  curl -fsSL http://itms.example.com/installers/install-itms-agent.sh | sudo bash -s -- --server-url http://itms.example.com --token-file /path/to/inventory-ingest-token [options]

Required:
  --server-url URL         ITMS backend base URL or full ingest endpoint
  --token-file FILE        Read INVENTORY_INGEST_TOKEN from FILE
  --prompt-token           Prompt for INVENTORY_INGEST_TOKEN without echo

Optional:
  --category NAME          Asset category reported to ITMS, default: auto (detect laptop/desktop/vm)
  --assigned-to-email MAIL Asset owner email reported to ITMS
  --assigned-to-name NAME  Employee name recorded for enrollment review
  --employee-code ID       Employee ID recorded for enrollment review
  --department-name NAME   Department recorded for enrollment review
  --asset-tag TAG          Override asset tag, default: hostname plus stable device suffix
  --name NAME              Override asset name, default: hostname
  --notes TEXT             Asset notes, default: Installed by ITMS bootstrap
  --salt-master HOST       Salt master hostname or IP to write into minion config
  --wazuh-manager HOST     Wazuh manager hostname or IP for the agent package
  --wazuh-group NAME       Wazuh group, default: default
  --openscap-profile NAME  OpenSCAP profile ID, default: auto-detect from the installed datastream
  --openscap-datastream PATH
                           Override the OpenSCAP datastream path when auto-detection is wrong
  --openscap-results-dir PATH
                           Directory for OpenSCAP result files, default: /var/lib/itms/openscap
  --openscap-scan-hours N  OpenSCAP scan interval in hours, default: 24
  --refresh-hours N        Inventory push interval in hours, default: 6
  --use-hardinfo-fallback  Install hardinfo and enable it as a fallback source for display details
  --require-salt           Fail the bootstrap if Salt installation does not succeed
  --collector-url URL      Download the Linux collector from URL instead of local repo copy
  --help                   Show this message

Environment overrides:
  ITMS_SALT_BOOTSTRAP_VERSION  Salt release passed to bootstrap-salt, default: 3006
EOF
}

log() {
  printf '[itms-bootstrap] %s\n' "$*"
}

log_stderr() {
  printf '[itms-bootstrap] %s\n' "$*" >&2
}

read_value_file() {
  local file_path="$1"
  local value

  if [[ ! -f "$file_path" ]]; then
    printf 'Value file not found: %s\n' "$file_path" >&2
    exit 1
  fi

  value="$(cat -- "$file_path")"
  printf '%s' "${value%$'\r'}"
}

read_secret_prompt() {
  local label="$1"
  local value

  if [[ -r /dev/tty ]]; then
    read -r -s -p "$label: " value < /dev/tty
    printf '\n' >&2
    printf '%s' "$value"
    return 0
  fi

  if ! IFS= read -r value; then
    printf 'Cannot read %s from stdin.\n' "$label" >&2
    exit 1
  fi

  printf '%s' "$value"
}

package_exists() {
  case "$PACKAGE_MANAGER" in
    apt)
      apt-cache show "$1" >/dev/null 2>&1
      ;;
    dnf|yum)
      "$PACKAGE_MANAGER" info "$1" >/dev/null 2>&1
      ;;
    *)
      return 1
      ;;
  esac
}

package_installed() {
  case "$PACKAGE_MANAGER" in
    apt)
      dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q 'install ok installed'
      ;;
    dnf|yum)
      rpm -q "$1" >/dev/null 2>&1
      ;;
    *)
      return 1
      ;;
  esac
}

append_if_available() {
  local package_name="$1"
  if package_exists "$package_name"; then
    INSTALL_PACKAGES+=("$package_name")
    return 0
  fi
  return 1
}

install_salt_minion() {
  local salt_package="salt-minion"

  if ! package_exists "$salt_package"; then
    log 'Salt Minion package is not available from current package sources. Trying the Salt bootstrap installer.'
    install_salt_minion_with_bootstrap
    return $?
  fi

  if package_installed "$salt_package"; then
    return 0
  fi

  case "$PACKAGE_MANAGER" in
    apt)
      if package_exists "salt-common"; then
        if apt-get install -y salt-common "$salt_package"; then
          return 0
        fi
      elif apt-get install -y "$salt_package"; then
        return 0
      fi
      ;;
    dnf|yum)
      if "$PACKAGE_MANAGER" install -y "$salt_package"; then
        return 0
      fi
      ;;
  esac

  log 'Salt Minion installation via the native package manager failed. Trying the Salt bootstrap installer.'
  install_salt_minion_with_bootstrap
}

install_salt_minion_with_bootstrap() {
  local bootstrap_script
  local first_line
  bootstrap_script="$(mktemp)"

  if ! curl -fsSL "$SALT_BOOTSTRAP_URL" -o "$bootstrap_script"; then
    rm -f "$bootstrap_script"
    log 'Salt bootstrap installer download failed.'
    return 1
  fi

  first_line="$(head -n 1 "$bootstrap_script" || true)"
  if [[ "$first_line" != '#!'*sh* ]]; then
    rm -f "$bootstrap_script"
    log 'Salt bootstrap installer download returned an unexpected payload instead of a shell script.'
    return 1
  fi

  chmod 0755 "$bootstrap_script"
  log "Installing Salt Minion via bootstrap-salt stable ${SALT_BOOTSTRAP_VERSION}"
  if bash "$bootstrap_script" stable "$SALT_BOOTSTRAP_VERSION"; then
    rm -f "$bootstrap_script"
    if package_installed "salt-minion"; then
      return 0
    fi
    log 'Salt bootstrap installer finished but salt-minion is still not installed.'
    return 1
  fi

  rm -f "$bootstrap_script"
  log 'Salt bootstrap installer failed.'
  return 1
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    printf 'This installer must run as root. Use sudo.\n' >&2
    exit 1
  fi
}

detect_linux_platform() {
  if [[ ! -f /etc/os-release ]]; then
    printf 'Unsupported Linux distribution: /etc/os-release not found.\n' >&2
    exit 1
  fi

  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian)
      PACKAGE_MANAGER="apt"
      LINUX_DISTRO_FAMILY="debian"
      ;;
    fedora)
      PACKAGE_MANAGER="dnf"
      LINUX_DISTRO_FAMILY="rpm"
      ;;
    centos|rhel|rocky|almalinux)
      if command -v dnf >/dev/null 2>&1; then
        PACKAGE_MANAGER="dnf"
      else
        PACKAGE_MANAGER="yum"
      fi
      LINUX_DISTRO_FAMILY="rpm"
      ;;
    *)
      printf 'This installer currently supports Ubuntu, Debian, Fedora, CentOS, and Red Hat family systems. Detected: %s\n' "${PRETTY_NAME:-unknown}" >&2
      exit 1
      ;;
  esac
}

configure_package_plan() {
  INSTALL_PACKAGES=(python3 ca-certificates curl unzip clamav)

  case "$PACKAGE_MANAGER" in
    apt)
      INSTALL_PACKAGES+=(python3-requests gnupg apt-transport-https clamav-daemon)
      ;;
    dnf|yum)
      INSTALL_PACKAGES+=(python3-requests gnupg2)
      if package_exists "clamd"; then
        INSTALL_PACKAGES+=(clamd)
      fi
      ;;
  esac

  if append_if_available "openscap-scanner"; then
    :
  else
    log 'OpenSCAP scanner package is not available from current package sources. Continuing without it.'
  fi

  if ! append_if_available "scap-security-guide"; then
    if ! append_if_available "ssg-base"; then
      log 'SCAP content package is not available from current package sources. Continuing without it.'
    fi
  fi

  if [[ "$USE_HARDINFO_FALLBACK" == "true" ]]; then
    if ! append_if_available "hardinfo"; then
      log 'hardinfo package is not available from current package sources. Continuing without hardinfo fallback.'
      USE_HARDINFO_FALLBACK="false"
    fi
  fi
}

install_base_packages() {
  case "$PACKAGE_MANAGER" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      log 'Installing Debian-family packages'
      apt-get update
      apt-get install -y "${INSTALL_PACKAGES[@]}"
      ;;
    dnf)
      log 'Installing RPM-family packages with dnf'
      dnf install -y "${INSTALL_PACKAGES[@]}"
      ;;
    yum)
      log 'Installing RPM-family packages with yum'
      yum install -y "${INSTALL_PACKAGES[@]}"
      ;;
  esac
}

write_env_file() {
  install -d -m 0755 /etc
  umask 077
  : > "$ENV_FILE"
  {
    printf 'ITMS_SERVER_URL=%q\n' "$SERVER_URL"
    printf 'ITMS_INGEST_TOKEN=%q\n' "$INGEST_TOKEN"
    printf 'ITMS_ASSET_CATEGORY=%q\n' "$CATEGORY"
    printf 'ITMS_ASSET_NOTES=%q\n' "$NOTES"
    if [[ -n "$ASSIGNED_TO_EMAIL" ]]; then
      printf 'ITMS_ASSIGNED_TO_EMAIL=%q\n' "$ASSIGNED_TO_EMAIL"
    fi
    if [[ -n "$ASSIGNED_TO_NAME" ]]; then
      printf 'ITMS_ASSIGNED_TO_NAME=%q\n' "$ASSIGNED_TO_NAME"
    fi
    if [[ -n "$EMPLOYEE_CODE" ]]; then
      printf 'ITMS_EMPLOYEE_CODE=%q\n' "$EMPLOYEE_CODE"
    fi
    if [[ -n "$DEPARTMENT_NAME" ]]; then
      printf 'ITMS_DEPARTMENT_NAME=%q\n' "$DEPARTMENT_NAME"
    fi
    if [[ -n "$ASSET_TAG" ]]; then
      printf 'ITMS_ASSET_TAG=%q\n' "$ASSET_TAG"
    fi
    if [[ -n "$ASSET_NAME" ]]; then
      printf 'ITMS_ASSET_NAME=%q\n' "$ASSET_NAME"
    fi
    if [[ -n "$SALT_MASTER" ]]; then
      printf 'ITMS_SALT_MASTER=%q\n' "$SALT_MASTER"
    fi
    if [[ -n "$WAZUH_MANAGER" ]]; then
      printf 'ITMS_WAZUH_MANAGER=%q\n' "$WAZUH_MANAGER"
    fi
    if [[ -n "$WAZUH_GROUP" ]]; then
      printf 'ITMS_WAZUH_GROUP=%q\n' "$WAZUH_GROUP"
    fi
    if [[ -n "$OPENSCAP_PROFILE" ]]; then
      printf 'ITMS_OPENSCAP_PROFILE=%q\n' "$OPENSCAP_PROFILE"
    fi
    if [[ -n "$OPENSCAP_DATASTREAM" ]]; then
      printf 'ITMS_OPENSCAP_DATASTREAM=%q\n' "$OPENSCAP_DATASTREAM"
    fi
    if [[ -n "$OPENSCAP_RESULTS_DIR" ]]; then
      printf 'ITMS_OPENSCAP_RESULTS_DIR=%q\n' "$OPENSCAP_RESULTS_DIR"
    fi
    if [[ "$INCLUDE_OPENSCAP_REPORT" == "true" ]]; then
      printf 'ITMS_INCLUDE_OPENSCAP_REPORT=true\n'
    fi
    if [[ -n "$CLAMAV_SCAN_PATHS" ]]; then
      printf 'ITMS_CLAMAV_SCAN_PATHS=%q\n' "$CLAMAV_SCAN_PATHS"
    fi
    if [[ -n "$CLAMAV_TIMEOUT" ]]; then
      printf 'ITMS_CLAMAV_TIMEOUT=%q\n' "$CLAMAV_TIMEOUT"
    fi
    if [[ "$USE_HARDINFO_FALLBACK" == "true" ]]; then
      printf 'ITMS_USE_HARDINFO_FALLBACK=true\n'
    fi
  } >> "$ENV_FILE"
  chmod 0600 "$ENV_FILE"
}

install_collector() {
  install -d -m 0755 "$INSTALL_DIR"
  if [[ -n "$COLLECTOR_SOURCE_DEFAULT" && -f "$COLLECTOR_SOURCE_DEFAULT" ]]; then
    install -m 0755 "$COLLECTOR_SOURCE_DEFAULT" "$COLLECTOR_TARGET"
    return
  fi

  if [[ -z "$COLLECTOR_URL" ]]; then
    COLLECTOR_URL="${SERVER_URL%/}/installers/push-system-inventory.py"
  fi

  curl -fsSL "$COLLECTOR_URL" -o "$COLLECTOR_TARGET"
  chmod 0755 "$COLLECTOR_TARGET"
}

configure_salt_minion() {
  if [[ -z "$SALT_MASTER" ]]; then
    log 'Salt Minion installed without a configured master. Pass --salt-master to bind it to your Salt master.'
    return
  fi

  install -d -m 0755 /etc/salt/minion.d
  cat > /etc/salt/minion.d/itms.conf <<EOF
master: $SALT_MASTER
EOF
}

configure_wazuh_agent() {
  local config_file="/var/ossec/etc/ossec.conf"
  local backup_file="${config_file}.itms-backup"

  if [[ -z "$WAZUH_MANAGER" ]]; then
    log 'Wazuh agent installed without a configured manager. Pass --wazuh-manager to bind it during bootstrap.'
    return
  fi

  if [[ ! -f "$config_file" ]]; then
    log 'Wazuh agent config file not found after installation. Skipping manager rewrite.'
    return
  fi

  cp "$config_file" "$backup_file"

  python3 - "$config_file" "$WAZUH_MANAGER" "$WAZUH_GROUP" <<'PY'
import pathlib
import sys
import xml.etree.ElementTree as ET

config_path = pathlib.Path(sys.argv[1])
manager = sys.argv[2].strip()
group = sys.argv[3].strip()
raw_text = config_path.read_text(encoding='utf-8')

wrapped_root = None
target_root = None

try:
    tree = ET.ElementTree(ET.fromstring(raw_text))
    target_root = tree.getroot()
except ET.ParseError:
    wrapped_root = ET.fromstring(f'<itms_root>{raw_text}</itms_root>')
    target_root = wrapped_root.find('ossec_config')
    if target_root is None:
        raise

client = target_root.find('client')
if client is None:
    client = ET.SubElement(target_root, 'client')

server = client.find('server')
if server is None:
    server = ET.SubElement(client, 'server')

address = server.find('address')
if address is None:
    address = ET.SubElement(server, 'address')
address.text = manager

for unsupported_agent in list(target_root.findall('agent')):
    target_root.remove(unsupported_agent)

if group:
  agent_cfg = ET.SubElement(target_root, 'agent')
  groups = ET.SubElement(agent_cfg, 'groups')
  groups.text = group

if wrapped_root is None:
    tree.write(config_path, encoding='unicode', xml_declaration=False)
else:
    serialized_children = []
    for child in wrapped_root:
        serialized_children.append(ET.tostring(child, encoding='unicode'))
    config_path.write_text('\n'.join(serialized_children) + '\n', encoding='utf-8')
PY

  if [[ -n "$WAZUH_GROUP" ]]; then
    log "Wazuh group assignment configured in ossec.conf: $WAZUH_GROUP"
  fi
}

detect_openscap_datastream() {
  if [[ -n "$OPENSCAP_DATASTREAM" ]]; then
    printf '%s\n' "$OPENSCAP_DATASTREAM"
    return 0
  fi

  local candidates=()
  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    local version_id="${VERSION_ID%%.*}"
    candidates+=(
      "/usr/share/xml/scap/ssg/content/ssg-${ID:-ubuntu}${version_id}-ds.xml"
      "/usr/share/xml/scap/ssg/content/ssg-${ID:-ubuntu}${VERSION_ID:-}-ds.xml"
    )
  fi
  candidates+=(
    "/usr/share/xml/scap/ssg/content/ssg-ubuntu2204-ds.xml"
    "/usr/share/xml/scap/ssg/content/ssg-ubuntu2404-ds.xml"
    "/usr/share/xml/scap/ssg/content/ssg-debian11-ds.xml"
    "/usr/share/xml/scap/ssg/content/ssg-debian12-ds.xml"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  find /usr/share/xml/scap/ssg/content -maxdepth 1 -name 'ssg-*-ds.xml' 2>/dev/null | head -n 1
}

openscap_platform_id() {
  if [[ ! -f /etc/os-release ]]; then
    return 1
  fi

  # shellcheck disable=SC1091
  . /etc/os-release
  if [[ -z "${ID:-}" || -z "${VERSION_ID:-}" ]]; then
    return 1
  fi

  printf '%s%s\n' "$ID" "${VERSION_ID//./}"
}

download_openscap_datastream() {
  local platform_id
  platform_id="$(openscap_platform_id || true)"
  if [[ -z "$platform_id" ]]; then
    log 'Unable to determine OS platform for OpenSCAP content download.' >&2
    return 1
  fi

  local datastream_name="ssg-${platform_id}-ds.xml"
  local target_path="$OPENSCAP_CONTENT_DIR/$datastream_name"
  if [[ -f "$target_path" ]]; then
    printf '%s\n' "$target_path"
    return 0
  fi

  local release_tag="$OPENSCAP_CONTENT_RELEASE"
  local release_version="${release_tag#v}"
  local archive_url="https://github.com/ComplianceAsCode/content/releases/download/${release_tag}/scap-security-guide-${release_version}.zip"
  local tmp_dir archive_path archive_member
  tmp_dir="$(mktemp -d)"
  archive_path="$tmp_dir/scap-security-guide.zip"
  trap 'rm -rf "$tmp_dir"' RETURN

  log "Downloading OpenSCAP content ${release_tag} for ${platform_id}" >&2
  if ! curl -fsSL "$archive_url" -o "$archive_path"; then
    log 'OpenSCAP content download failed.' >&2
    return 1
  fi

  archive_member="$(unzip -Z1 "$archive_path" | grep "/${datastream_name}$" | head -n 1 || true)"
  if [[ -z "$archive_member" ]]; then
    log "OpenSCAP datastream ${datastream_name} was not present in ${archive_url}." >&2
    return 1
  fi

  install -d -m 0755 "$OPENSCAP_CONTENT_DIR"
  if ! unzip -p "$archive_path" "$archive_member" > "$target_path"; then
    log 'Failed to extract OpenSCAP datastream from downloaded archive.' >&2
    rm -f "$target_path"
    return 1
  fi
  chmod 0644 "$target_path"
  printf '%s\n' "$target_path"
}

resolve_openscap_profile() {
  local datastream="$1"
  local requested_profile="${OPENSCAP_PROFILE:-auto}"
  local category_normalized="${CATEGORY,,}"
  local -a available_profiles=()
  local -a preferred_profiles=()
  local profile

  if ! command -v oscap >/dev/null 2>&1; then
    log_stderr 'OpenSCAP profile auto-detection skipped because oscap is not installed.'
    return 1
  fi

  mapfile -t available_profiles < <(
    oscap info "$datastream" 2>/dev/null | awk '
      /^Profiles:/ { in_profiles = 1; next }
      in_profiles && /^[[:alpha:]][[:alnum:] _-]*:/ { exit }
      in_profiles && /^[[:space:]]*Id:[[:space:]]*/ {
        sub(/^[[:space:]]*Id:[[:space:]]*/, "")
        print
      }
    '
  )

  if [[ ${#available_profiles[@]} -eq 0 ]]; then
    log_stderr "OpenSCAP profiles could not be read from ${datastream}."
    return 1
  fi

  if [[ -n "$requested_profile" && "$requested_profile" != "auto" ]]; then
    for profile in "${available_profiles[@]}"; do
      if [[ "$profile" == "$requested_profile" ]]; then
        printf '%s\n' "$profile"
        return 0
      fi
    done
    log_stderr "Requested OpenSCAP profile ${requested_profile} is not available in ${datastream}. Falling back to an available profile."
  fi

  if [[ "$category_normalized" == "server" ]]; then
    preferred_profiles=(
      "xccdf_org.ssgproject.content_profile_cis_level1_server"
      "xccdf_org.ssgproject.content_profile_standard"
      "xccdf_org.ssgproject.content_profile_cis_level1_workstation"
    )
  else
    preferred_profiles=(
      "xccdf_org.ssgproject.content_profile_cis_level1_workstation"
      "xccdf_org.ssgproject.content_profile_standard"
      "xccdf_org.ssgproject.content_profile_cis_level1_server"
    )
  fi

  local candidate
  for candidate in "${preferred_profiles[@]}"; do
    for profile in "${available_profiles[@]}"; do
      if [[ "$profile" == "$candidate" ]]; then
        printf '%s\n' "$profile"
        return 0
      fi
    done
  done

  printf '%s\n' "${available_profiles[0]}"
}

install_openscap_runner() {
  local datastream
  if ! command -v oscap >/dev/null 2>&1; then
    log 'OpenSCAP binary not found after package installation. Skipping OpenSCAP runner setup.'
    return
  fi

  datastream=$(detect_openscap_datastream)
  if [[ -z "$datastream" || ! -f "$datastream" ]]; then
    datastream="$(download_openscap_datastream || true)"
  fi
  if [[ -z "$datastream" || ! -f "$datastream" ]]; then
    log 'OpenSCAP datastream could not be auto-detected. Install SCAP content or pass --openscap-datastream to configure scanning.'
    return
  fi

  OPENSCAP_DATASTREAM="$datastream"
  OPENSCAP_PROFILE="$(resolve_openscap_profile "$datastream" || true)"
  if [[ -z "$OPENSCAP_PROFILE" ]]; then
    log 'OpenSCAP profile could not be resolved from the detected datastream. Pass --openscap-profile to configure scanning.'
    return
  fi
  log "Using OpenSCAP profile ${OPENSCAP_PROFILE}"
  install -d -m 0755 "$INSTALL_DIR" "$OPENSCAP_RESULTS_DIR"
  cat > "$OPENSCAP_RUNNER" <<'EOF'
#!/usr/bin/env bash
set -uo pipefail

ENV_FILE="/etc/itms-agent.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

if ! command -v oscap >/dev/null 2>&1; then
  echo "oscap not found" >&2
  exit 1
fi

if [[ -z "${ITMS_OPENSCAP_DATASTREAM:-}" || ! -f "${ITMS_OPENSCAP_DATASTREAM}" ]]; then
  echo "OpenSCAP datastream is not configured" >&2
  exit 1
fi

RESULTS_DIR="${ITMS_OPENSCAP_RESULTS_DIR:-/var/lib/itms/openscap}"
PROFILE="${ITMS_OPENSCAP_PROFILE:-}"
if [[ -z "$PROFILE" ]]; then
  echo "OpenSCAP profile is not configured" >&2
  exit 1
fi
mkdir -p "$RESULTS_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RESULTS_FILE="$RESULTS_DIR/openscap-results-$STAMP.xml"
REPORT_FILE="$RESULTS_DIR/openscap-report-$STAMP.html"

set +e
oscap xccdf eval \
  --profile "$PROFILE" \
  --results "$RESULTS_FILE" \
  --report "$REPORT_FILE" \
  "$ITMS_OPENSCAP_DATASTREAM"
SCAN_EXIT=$?
set -e

if [[ "${ITMS_INCLUDE_OPENSCAP_REPORT:-true}" == "true" && -f "$RESULTS_FILE" ]]; then
  /usr/bin/python3 /opt/itms/push-system-inventory.py --include-openscap-report --no-software-scan || true
fi

exit "$SCAN_EXIT"
EOF
  chmod 0755 "$OPENSCAP_RUNNER"
}

write_openscap_units() {
  if [[ -z "$OPENSCAP_DATASTREAM" || ! -f "$OPENSCAP_DATASTREAM" ]]; then
    return
  fi

  cat > "$OPENSCAP_SERVICE" <<EOF
[Unit]
Description=Run ITMS OpenSCAP scan
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=$ENV_FILE
ExecStart=$OPENSCAP_RUNNER

[Install]
WantedBy=multi-user.target
EOF

  cat > "$OPENSCAP_TIMER" <<EOF
[Unit]
Description=Run ITMS OpenSCAP scan every $OPENSCAP_SCAN_HOURS hours

[Timer]
OnBootSec=15min
OnUnitActiveSec=${OPENSCAP_SCAN_HOURS}h
Unit=itms-openscap-scan.service

[Install]
WantedBy=timers.target
EOF
}

write_clamav_units() {
  cat > "$CLAMAV_SERVICE" <<EOF
[Unit]
Description=Run ITMS ClamAV scan and report
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/python3 $COLLECTOR_TARGET --include-clamav-report

[Install]
WantedBy=multi-user.target
EOF

  cat > "$CLAMAV_TIMER" <<EOF
[Unit]
Description=Run ITMS ClamAV scan every day at 12:00

[Timer]
OnCalendar=*-*-* 12:00:00
Persistent=true
Unit=itms-clamav-scan.service

[Install]
WantedBy=timers.target
EOF
}

install_wazuh_agent() {
  if package_installed "wazuh-manager"; then
    log 'Wazuh manager is already installed on this host. Skipping wazuh-agent to avoid replacing the manager role.'
    return
  fi

  if package_installed "wazuh-agent"; then
    return
  fi

  case "$PACKAGE_MANAGER" in
    apt)
      if [[ ! -f /etc/apt/sources.list.d/wazuh.list ]]; then
        curl -fsSL https://packages.wazuh.com/key/GPG-KEY-WAZUH | gpg --dearmor -o /usr/share/keyrings/wazuh.gpg
        echo 'deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main' > /etc/apt/sources.list.d/wazuh.list
        apt-get update
      fi

      if [[ -n "$WAZUH_MANAGER" ]]; then
        WAZUH_MANAGER="$WAZUH_MANAGER" WAZUH_AGENT_GROUP="$WAZUH_GROUP" apt-get install -y wazuh-agent
        return
      fi

      apt-get install -y wazuh-agent
      ;;
    dnf|yum)
      if [[ ! -f /etc/yum.repos.d/wazuh.repo ]]; then
        rpm --import https://packages.wazuh.com/key/GPG-KEY-WAZUH
        cat > /etc/yum.repos.d/wazuh.repo <<'EOF'
[wazuh]
gpgcheck=1
gpgkey=https://packages.wazuh.com/key/GPG-KEY-WAZUH
enabled=1
name=EL-$releasever - Wazuh
baseurl=https://packages.wazuh.com/4.x/yum/
protect=1
EOF
        "$PACKAGE_MANAGER" makecache -y >/dev/null 2>&1 || true
      fi

      if [[ -n "$WAZUH_MANAGER" ]]; then
        WAZUH_MANAGER="$WAZUH_MANAGER" WAZUH_AGENT_GROUP="$WAZUH_GROUP" "$PACKAGE_MANAGER" install -y wazuh-agent
        return
      fi

      "$PACKAGE_MANAGER" install -y wazuh-agent
      ;;
  esac

  log 'Wazuh agent installed without a configured manager. Pass --wazuh-manager to connect it during bootstrap.'
}

write_systemd_units() {
  cat > "$SYSTEMD_SERVICE" <<EOF
[Unit]
Description=Push ITMS inventory snapshot
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/python3 $COLLECTOR_TARGET

[Install]
WantedBy=multi-user.target
EOF

  cat > "$SYSTEMD_TIMER" <<EOF
[Unit]
Description=Run ITMS inventory refresh every $REFRESH_HOURS hours

[Timer]
OnBootSec=5min
OnUnitActiveSec=${REFRESH_HOURS}h
Unit=itms-inventory-refresh.service

[Install]
WantedBy=timers.target
EOF
}

run_initial_inventory_push() {
  local -a collector_args
  collector_args=(
    /usr/bin/python3
    "$COLLECTOR_TARGET"
    --server-url "$SERVER_URL"
    --category "$CATEGORY"
    --notes "$NOTES"
  )

  if [[ -n "$ASSIGNED_TO_EMAIL" ]]; then
    collector_args+=(--assigned-to-email "$ASSIGNED_TO_EMAIL")
  fi
  if [[ -n "$ASSIGNED_TO_NAME" ]]; then
    collector_args+=(--assigned-to-name "$ASSIGNED_TO_NAME")
  fi
  if [[ -n "$EMPLOYEE_CODE" ]]; then
    collector_args+=(--employee-code "$EMPLOYEE_CODE")
  fi
  if [[ -n "$DEPARTMENT_NAME" ]]; then
    collector_args+=(--department-name "$DEPARTMENT_NAME")
  fi
  if [[ -n "$ASSET_TAG" ]]; then
    collector_args+=(--asset-tag "$ASSET_TAG")
  fi
  if [[ -n "$ASSET_NAME" ]]; then
    collector_args+=(--name "$ASSET_NAME")
  fi
  if [[ "$USE_HARDINFO_FALLBACK" == "true" ]]; then
    collector_args+=(--use-hardinfo-fallback)
  fi

  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  "${collector_args[@]}"
}

prompt_if_missing() {
  local label="$1"
  local var_name="$2"
  local current_value="${!var_name}"
  if [[ -n "$current_value" ]]; then
    return
  fi
  if [[ ! -t 0 ]]; then
    return
  fi
  read -r -p "$label: " current_value
  printf -v "$var_name" '%s' "$current_value"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --server-url)
        SERVER_URL="${2:-}"
        shift 2
        ;;
      --token-file)
        INGEST_TOKEN_FILE="${2:-}"
        shift 2
        ;;
      --prompt-token)
        PROMPT_INGEST_TOKEN=1
        shift
        ;;
      --category)
        CATEGORY="${2:-}"
        shift 2
        ;;
      --assigned-to-email)
        ASSIGNED_TO_EMAIL="${2:-}"
        shift 2
        ;;
      --assigned-to-name)
        ASSIGNED_TO_NAME="${2:-}"
        shift 2
        ;;
      --employee-code)
        EMPLOYEE_CODE="${2:-}"
        shift 2
        ;;
      --department-name)
        DEPARTMENT_NAME="${2:-}"
        shift 2
        ;;
      --asset-tag)
        ASSET_TAG="${2:-}"
        shift 2
        ;;
      --name)
        ASSET_NAME="${2:-}"
        shift 2
        ;;
      --notes)
        NOTES="${2:-}"
        shift 2
        ;;
      --salt-master)
        SALT_MASTER="${2:-}"
        shift 2
        ;;
      --wazuh-manager)
        WAZUH_MANAGER="${2:-}"
        shift 2
        ;;
      --wazuh-group)
        WAZUH_GROUP="${2:-}"
        shift 2
        ;;
      --openscap-profile)
        OPENSCAP_PROFILE="${2:-}"
        shift 2
        ;;
      --openscap-datastream)
        OPENSCAP_DATASTREAM="${2:-}"
        shift 2
        ;;
      --openscap-results-dir)
        OPENSCAP_RESULTS_DIR="${2:-}"
        shift 2
        ;;
      --openscap-scan-hours)
        OPENSCAP_SCAN_HOURS="${2:-}"
        shift 2
        ;;
      --refresh-hours)
        REFRESH_HOURS="${2:-}"
        shift 2
        ;;
      --use-hardinfo-fallback)
        USE_HARDINFO_FALLBACK="true"
        shift
        ;;
      --require-salt)
        REQUIRE_SALT="true"
        shift
        ;;
      --collector-url)
        COLLECTOR_URL="${2:-}"
        shift 2
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        printf 'Unknown option: %s\n' "$1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done

  if [[ -n "$INGEST_TOKEN_FILE" ]]; then
    INGEST_TOKEN="$(read_value_file "$INGEST_TOKEN_FILE")"
  elif [[ "$PROMPT_INGEST_TOKEN" -eq 1 ]]; then
    INGEST_TOKEN="$(read_secret_prompt "Inventory ingest token")"
  fi

  if [[ -z "$SERVER_URL" || -z "$INGEST_TOKEN" ]]; then
    usage >&2
    exit 1
  fi

  if [[ ! "$REFRESH_HOURS" =~ ^[0-9]+$ ]] || [[ "$REFRESH_HOURS" -lt 1 ]]; then
    printf '--refresh-hours must be a positive integer.\n' >&2
    exit 1
  fi

  if [[ ! "$OPENSCAP_SCAN_HOURS" =~ ^[0-9]+$ ]] || [[ "$OPENSCAP_SCAN_HOURS" -lt 1 ]]; then
    printf '--openscap-scan-hours must be a positive integer.\n' >&2
    exit 1
  fi

  case "${REQUIRE_SALT,,}" in
    true|false)
      ;;
    *)
      printf '--require-salt must resolve to true or false.\n' >&2
      exit 1
      ;;
  esac
}

main() {
  parse_args "$@"
  require_root
  detect_linux_platform

  prompt_if_missing "Employee name" ASSIGNED_TO_NAME
  prompt_if_missing "Employee email" ASSIGNED_TO_EMAIL
  prompt_if_missing "Employee ID" EMPLOYEE_CODE
  prompt_if_missing "Employee department" DEPARTMENT_NAME

  configure_package_plan
  install_base_packages

  salt_install_succeeded=false
  if [[ -n "$SALT_MASTER" ]]; then
    log 'Installing Salt minion for the configured Salt master'
    if install_salt_minion; then
      salt_install_succeeded=true
    else
      if [[ "${REQUIRE_SALT,,}" == "true" ]]; then
        log 'Salt Minion installation failed and Salt is marked as required for this bootstrap. Aborting.'
        exit 1
      fi
      log 'Salt Minion installation failed while --salt-master was provided. Continuing without Salt because --require-salt was not set.'
    fi
  else
    log 'Installing Salt minion when available'
    if install_salt_minion; then
      salt_install_succeeded=true
    else
      log 'Continuing without Salt because no --salt-master was requested.'
    fi
  fi

  log 'Installing Wazuh agent'
  install_wazuh_agent

  log 'Deploying ITMS collector and config'
  install_collector
  if [[ "$salt_install_succeeded" == "true" ]]; then
    configure_salt_minion
  fi
  configure_wazuh_agent
  install_openscap_runner
  write_env_file
  write_systemd_units
  write_openscap_units
  write_clamav_units

  log 'Enabling services'
  systemctl daemon-reload
  if [[ "$salt_install_succeeded" == "true" ]]; then
    systemctl enable --now salt-minion || true
  fi
  systemctl enable --now clamav-daemon || true
  systemctl enable --now clamav-freshclam || true
  systemctl enable --now wazuh-agent || true
  systemctl enable --now itms-inventory-refresh.timer
  if [[ "$salt_install_succeeded" == "true" && -n "$SALT_MASTER" ]]; then
    systemctl restart salt-minion || true
  fi
  if [[ -n "$WAZUH_MANAGER" ]]; then
    systemctl restart wazuh-agent || true
  fi
  if [[ -f "$OPENSCAP_TIMER" ]]; then
    systemctl enable --now itms-openscap-scan.timer || true
  fi
  if [[ -f "$CLAMAV_TIMER" ]]; then
    systemctl enable --now itms-clamav-scan.timer || true
  fi

  log 'Pushing initial inventory snapshot'
  run_initial_inventory_push

  log 'Bootstrap complete'
}

main "$@"
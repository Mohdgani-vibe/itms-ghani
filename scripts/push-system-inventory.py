#!/usr/bin/env python3

import argparse
import datetime
import gzip
import getpass
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path


AGENT_ENV_FILE = Path(os.getenv("ITMS_AGENT_ENV_FILE", "/etc/itms-agent.env"))

USER_APT_EXCLUDE_PATTERN = re.compile(
    r"^lib|^linux-|^grub|^shim|^init$|^login$|^dash$|^bash$|^gzip$"
    r"|^grep$|^sed$|^gawk$|^ncurses|^bsdutils$|^diffutils$|^findutils$"
    r"|^hostname$|^lvm2$|^cryptsetup$|^efibootmgr$|^language-pack"
    r"|^wbritish$|^wamerican$|^ubuntu-minimal$|^ubuntu-standard$"
    r"|^ubuntu-desktop|^ubuntu-wallpapers$|^ca-certificates$|^gnupg$"
    r"|^gpg$|^dbus|^apt-transport-https$|^apt$|^dpkg$|^perl|^python3$"
    r"|^tzdata$|^locales|^adduser$|^passwd$|^sudo$|^coreutils$"
    r"|^util-linux|^mount$|^tar$|^xz-utils$|^bzip2$|^less$|^nano$"
    r"|^netbase$|^iproute2$|^iputils|^net-tools$|^ifupdown|^systemd"
    r"|^udev$|^dconf-|^gsettings-|^glib|^gtk|^xserver-xorg-input-wacom$"
    r"|^xfonts|^fonts-|^build-essential$|^gcc$|^g\+\+$|^make$|^cmake$"
    r"|^libc6-dev$|^libcap-dev$|^libx11-dev$|^libxrandr-dev$|^libevdev"
    r"|^libgtk|^libm17n|^libmarisa|^libopencc|^libotf|^libpinyin"
    r"|^libchewing|^ssh$|^expect$|^wget$|^curl$|^python3-",
    re.IGNORECASE,
)

DPKG_INSTALL_PATTERN = re.compile(r"^(\d{4}-\d{2}-\d{2})\s+\S+\s+install\s+(\S+?)(?::\S+)?\s")


def run_command(command, timeout=15):
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        return ""
    if result.returncode != 0 and not result.stdout:
        return ""
    return result.stdout.strip()


def read_text(path):
    try:
        return Path(path).read_text(encoding="utf-8", errors="ignore").strip()
    except OSError:
        return ""


def read_value_file(path):
    try:
        return Path(path).expanduser().read_text(encoding="utf-8", errors="ignore").rstrip("\r\n")
    except OSError:
        return ""


def read_secret_prompt(label):
    if sys.stdin.isatty() or sys.stderr.isatty():
        return getpass.getpass(f"{label}: ").strip()

    value = sys.stdin.readline()
    if not value:
        return ""
    return value.rstrip("\r\n")


def env_file_value(name):
    if not AGENT_ENV_FILE.is_file():
        return ""

    prefix = f"{name}="
    try:
        for line in AGENT_ENV_FILE.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith(prefix):
                return line[len(prefix):].strip()
    except OSError:
        return ""
    return ""


def env_flag(name):
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def env_list(name):
    raw = os.getenv(name, "").strip()
    if not raw:
        return []
    values = []
    for part in raw.replace(";", ",").split(","):
        value = part.strip()
        if value:
            values.append(value)
    return values


def command_exists(name):
    return shutil.which(name) is not None


def parse_summary_count(value):
    if not value:
        return 0
    first_token = value.split()[0].strip()
    return int(first_token) if first_token.isdigit() else 0


def parse_os_release():
    values = {}
    for line in read_text("/etc/os-release").splitlines():
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value.strip().strip('"')
    return values


def format_bytes(size_bytes):
    if size_bytes <= 0:
        return "Unknown"
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    value = float(size_bytes)
    unit_index = 0
    while value >= 1024 and unit_index < len(units) - 1:
        value /= 1024
        unit_index += 1
    if value >= 100 or unit_index == 0:
        return f"{int(round(value))} {units[unit_index]}"
    return f"{value:.1f} {units[unit_index]}"


def truncate_text(value, limit=20000):
    value = (value or "").strip()
    if len(value) <= limit:
        return value
    return value[: limit - 16].rstrip() + "\n... output truncated"


def collect_processor():
    for line in read_text("/proc/cpuinfo").splitlines():
        if line.lower().startswith("model name"):
            return line.split(":", 1)[1].strip()
    output = run_command(["lscpu"])
    for line in output.splitlines():
        if line.lower().startswith("model name:"):
            return line.split(":", 1)[1].strip()
    return platform.processor() or "Unknown CPU"


def collect_memory():
    for line in read_text("/proc/meminfo").splitlines():
        if line.startswith("MemTotal:"):
            parts = line.split()
            if len(parts) >= 2 and parts[1].isdigit():
                return format_bytes(int(parts[1]) * 1024)
    return "Unknown RAM"


def collect_storage():
    output = run_command(["lsblk", "-b", "-dn", "-o", "SIZE,TYPE"])
    total = 0
    for line in output.splitlines():
        parts = line.split()
        if len(parts) != 2:
            continue
        size, device_type = parts
        if device_type != "disk" or not size.isdigit():
            continue
        total += int(size)
    if total == 0:
        return "Unknown storage"
    return format_bytes(total)


def flatten_block_devices(devices, parent=""):
    flattened = []
    for device in devices or []:
        current = dict(device)
        current["parent_name"] = parent
        flattened.append(current)
        flattened.extend(flatten_block_devices(device.get("children") or [], device.get("name", "")))
    return flattened


def collect_volume_details():
    output = run_command([
        "lsblk",
        "-J",
        "-b",
        "-o",
        "NAME,PATH,SIZE,FSTYPE,TYPE,MOUNTPOINT,FSAVAIL,FSUSE%,UUID,PKNAME",
    ], timeout=20)
    if not output:
        return []

    try:
        parsed = json.loads(output)
    except json.JSONDecodeError:
        return []

    volumes = []
    for item in flatten_block_devices(parsed.get("blockdevices") or []):
        device_type = (item.get("type") or "").strip().lower()
        if device_type in {"loop", "rom"}:
            continue
        name = (item.get("name") or "").strip()
        path = (item.get("path") or "").strip()
        fstype = (item.get("fstype") or "").strip()
        mountpoint = (item.get("mountpoint") or "").strip()
        encrypted = fstype.lower() == "crypto_luks" or path.startswith("/dev/mapper/") or name.startswith("dm-")
        encryption = "LUKS" if fstype.lower() == "crypto_luks" else ("device-mapper" if encrypted else "")
        size_raw = item.get("size")
        available_raw = item.get("fsavail")

        volumes.append({
            "name": name,
            "path": path,
            "size": format_bytes(int(size_raw)) if str(size_raw).isdigit() else str(size_raw or ""),
            "filesystem": fstype,
            "device_type": device_type,
            "mountpoint": mountpoint,
            "available": format_bytes(int(available_raw)) if str(available_raw).isdigit() else str(available_raw or ""),
            "used_percent": str(item.get("fsuse%") or ""),
            "uuid": (item.get("uuid") or "").strip(),
            "parent": (item.get("pkname") or item.get("parent_name") or "").strip(),
            "encrypted": encrypted,
            "encryption": encryption,
        })
    return volumes


def collect_disk_layout():
    return truncate_text(run_command(["fdisk", "-l"], timeout=20))


def collect_remote_access_id(command, args=None):
    if not command_exists(command):
        return ""
    output = run_command([command, *(args or ["--get-id"])], timeout=10)
    return output.splitlines()[0].strip() if output else ""


def collect_gpu():
    if not command_exists("lspci"):
        return ""
    devices = []
    for line in run_command(["lspci"]).splitlines():
        normalized = line.lower()
        if "vga compatible controller" not in normalized and "3d controller" not in normalized and "display controller" not in normalized:
            continue
        label = line.split(": ", 1)[1].strip() if ": " in line else line.strip()
        if label and label not in devices:
            devices.append(label)
    return "; ".join(devices)


@lru_cache(maxsize=1)
def collect_hardinfo_report():
    if not command_exists("hardinfo"):
        return ""
    return run_command(["hardinfo", "-r"], timeout=30)


def collect_display(use_hardinfo_fallback=False):
    display_name = os.getenv("DISPLAY", "").strip()
    if display_name and command_exists("xrandr"):
        connected = []
        for line in run_command(["xrandr", "--current"]).splitlines():
            if " connected" not in line:
                continue
            parts = line.split()
            if not parts:
                continue
            output_name = parts[0]
            resolution = ""
            for part in parts[1:]:
                if "x" in part and "+" in part:
                    resolution = part.split("+", 1)[0]
                    break
            connected.append(f"{output_name} {resolution}".strip())
        if connected:
            return "; ".join(connected)

    if not use_hardinfo_fallback:
        return ""

    resolution = ""
    renderer = ""
    for line in collect_hardinfo_report().splitlines():
        stripped = line.strip()
        if stripped.startswith("Resolution") and ":" in stripped:
            resolution = stripped.split(":", 1)[1].strip()
        elif stripped.startswith("OpenGL Renderer") and ":" in stripped:
            renderer = stripped.split(":", 1)[1].strip()
    details = []
    if resolution and resolution != "0x0 pixels":
        details.append(resolution)
    if renderer and renderer != "(Unknown)":
        details.append(renderer)
    return "; ".join(details)


def collect_primary_mac_address():
    if not command_exists("ip"):
        return ""
    primary = ""
    fallback = ""
    virtual_prefixes = ("docker", "br-", "veth", "virbr", "lo", "tun", "tap", "wg")
    for line in run_command(["ip", "-o", "link", "show"]).splitlines():
        if "link/ether" not in line:
            continue
        parts = line.split(": ", 2)
        if len(parts) < 2:
            continue
        interface_name = parts[1].split("@", 1)[0].strip()
        mac_address = line.split("link/ether", 1)[1].strip().split()[0].lower()
        if not fallback:
            fallback = mac_address
        if interface_name.startswith(virtual_prefixes):
            continue
        primary = mac_address
        break
    return primary or fallback


def collect_last_boot():
    value = run_command(["bash", "-lc", "date -u -d \"$(uptime -s)\" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null"])
    if value:
        return value

    boot_line = run_command(["who", "-b"])
    if not boot_line:
        return ""
    text = boot_line.split("system boot", 1)[-1].strip()
    if not text:
        return ""
    for fmt in ("%Y-%m-%d %H:%M", "%b %d %H:%M"):
        try:
            parsed = datetime.datetime.strptime(text, fmt)
        except ValueError:
            continue
        if fmt == "%b %d %H:%M":
            parsed = parsed.replace(year=datetime.datetime.utcnow().year)
        return parsed.strftime("%Y-%m-%dT%H:%M:%SZ")
    return ""


def collect_serial_number():
    return read_text("/sys/class/dmi/id/product_serial") or read_text("/sys/devices/virtual/dmi/id/product_serial") or ""


def collect_manufacturer():
    return read_text("/sys/class/dmi/id/sys_vendor") or ""


def collect_model():
    return read_text("/sys/class/dmi/id/product_name") or ""


def collect_source_fingerprint():
    for candidate in (
        "/etc/machine-id",
        "/var/lib/dbus/machine-id",
        "/sys/class/dmi/id/product_uuid",
        "/sys/class/dmi/id/product_serial",
    ):
        value = read_text(candidate).strip().lower()
        if value:
            return value
    return collect_hostname().lower()


def collect_hostname():
    return socket.gethostname().strip()


def build_default_asset_tag(hostname, source_fingerprint):
    hostname_key = "".join(ch for ch in hostname.upper() if ch.isalnum()) or "SYSTEM"
    suffix = "".join(ch for ch in source_fingerprint.upper() if ch.isalnum())[:8]
    if not suffix:
        return hostname_key[:20]
    prefix_length = max(1, 20 - len(suffix) - 1)
    return f"{hostname_key[:prefix_length]}-{suffix}"


def collect_salt_minion_id():
    minion_id = read_text("/etc/salt/minion_id")
    if minion_id:
        return minion_id
    if not run_command(["bash", "-lc", "command -v salt-call >/dev/null 2>&1 && echo yes"]):
        return ""
    detected = run_command(["bash", "-lc", "salt-call --local grains.get id --out=newline_values_only 2>/dev/null | tail -n 1"])
    return detected.strip()


def collect_wazuh_agent_id():
    for path in ["/var/ossec/etc/client.keys", "/Library/Ossec/etc/client.keys"]:
        content = read_text(path)
        if not content:
            continue
        first_line = content.splitlines()[0].strip()
        if not first_line:
            continue
        parts = first_line.split()
        if parts:
            agent_id = parts[0].strip()
            if agent_id.isdigit():
                return agent_id
        if len(parts) >= 2:
            return parts[1].strip()
    return ""


def read_chassis_type():
    value = read_text("/sys/class/dmi/id/chassis_type") or read_text("/sys/devices/virtual/dmi/id/chassis_type")
    return value.strip()


def infer_asset_category(requested_category, manufacturer, model):
    normalized = (requested_category or "").strip().lower()
    if normalized and normalized != "auto":
        return normalized

    virtualization = run_command(["systemd-detect-virt"])
    model_text = f"{manufacturer} {model}".lower()
    virtual_markers = ["virtualbox", "vmware", "kvm", "qemu", "hyper-v", "virtual machine", "bochs"]
    if virtualization and virtualization != "none":
        return "vm"
    if any(marker in model_text for marker in virtual_markers):
        return "vm"

    chassis_type = read_chassis_type()
    if chassis_type in {"8", "9", "10", "14"}:
        return "laptop"

    return "desktop"


def collect_bios_version():
    return read_text("/sys/class/dmi/id/bios_version") or ""


def collect_os_details():
    os_release = parse_os_release()
    os_name = os_release.get("PRETTY_NAME") or f"{platform.system()} {platform.release()}".strip()
    os_version = os_release.get("VERSION_ID") or platform.release()
    kernel = platform.release()
    architecture = platform.machine() or "unknown"
    os_build = platform.version()
    return os_name, os_version, kernel, architecture, os_build


def collect_pending_updates():
    apt_output = run_command(["bash", "-lc", "apt list --upgradable 2>/dev/null | tail -n +2 | wc -l"])
    if apt_output.isdigit():
        return int(apt_output)

    dnf_output = run_command(["bash", "-lc", "dnf -q check-update 2>/dev/null | grep -Ec '^[A-Za-z0-9_.+-]+'"]) 
    if dnf_output.isdigit():
        return int(dnf_output)

    yum_output = run_command(["bash", "-lc", "yum -q check-update 2>/dev/null | grep -Ec '^[A-Za-z0-9_.+-]+'"]) 
    if yum_output.isdigit():
        return int(yum_output)

    return 0


def collect_pending_update_details():
    apt_output = run_command(["bash", "-lc", "apt list --upgradable 2>/dev/null | tail -n +2"])
    if apt_output:
        details = []
        for line in apt_output.splitlines():
            entry = line.strip()
            if not entry:
                continue
            package_name = entry.split("/", 1)[0].strip()
            if package_name:
                details.append(package_name)
        if details:
            return details

    dnf_output = run_command(["bash", "-lc", "dnf -q check-update 2>/dev/null"])
    if dnf_output:
        details = []
        for line in dnf_output.splitlines():
            entry = line.strip()
            if not entry or entry.startswith("Last metadata expiration check:"):
                continue
            fields = entry.split()
            if len(fields) < 2:
                continue
            package_name = fields[0].strip()
            if package_name:
                details.append(package_name)
        if details:
            return details

    yum_output = run_command(["bash", "-lc", "yum -q check-update 2>/dev/null"])
    if yum_output:
        details = []
        for line in yum_output.splitlines():
            entry = line.strip()
            if not entry:
                continue
            fields = entry.split()
            if len(fields) < 2:
                continue
            package_name = fields[0].strip()
            if package_name:
                details.append(package_name)
        if details:
            return details

    return []


def collect_logged_in_users():
    users = []
    seen = set()

    def add_candidate(value):
        candidate = (value or "").strip()
        if not candidate or candidate in seen:
            return
        seen.add(candidate)
        users.append(candidate)

    for line in run_command(["who"]).splitlines():
        parts = line.split()
        if parts:
            add_candidate(parts[0])

    loginctl_output = run_command(["bash", "-lc", "loginctl list-sessions --no-legend 2>/dev/null"])
    for line in loginctl_output.splitlines():
        parts = line.split()
        if len(parts) >= 3:
            add_candidate(parts[2])

    add_candidate(os.getenv("SUDO_USER", ""))
    return users


def collect_network_details():
    if not command_exists("ip"):
        return {
            "wired_ip": "",
            "wireless_ip": "",
            "netbird_ip": "",
            "dns": "",
            "gateway": "",
            "interface_stats": {},
        }

    output = run_command(["ip", "-j", "addr", "show"])
    try:
        interfaces = json.loads(output) if output else []
    except json.JSONDecodeError:
        interfaces = []

    wired_ip = ""
    wireless_ip = ""
    netbird_ip = ""
    interface_stats = {}
    ignored_prefixes = ("lo", "docker", "br-", "veth", "virbr")

    for item in interfaces:
        interface_name = str(item.get("ifname", "")).strip()
        if not interface_name or interface_name.startswith(ignored_prefixes):
            continue
        if item.get("operstate") == "DOWN":
            continue

        addresses = []
        for addr_info in item.get("addr_info", []):
            if addr_info.get("family") != "inet":
                continue
            local_address = str(addr_info.get("local", "")).strip()
            if not local_address or local_address.startswith("127."):
                continue
            addresses.append(local_address)
        if not addresses:
            continue

        interface_stats[interface_name] = {
            "mtu": item.get("mtu"),
            "state": item.get("operstate"),
            "mac": item.get("address", ""),
            "addresses": addresses,
        }

        primary_address = addresses[0]
        normalized_name = interface_name.lower()
        if normalized_name.startswith("netbird") or normalized_name.startswith("wt"):
            if not netbird_ip:
                netbird_ip = primary_address
            continue
        if normalized_name.startswith("wl") or "wifi" in normalized_name or "wlan" in normalized_name:
            if not wireless_ip:
                wireless_ip = primary_address
            continue
        if not wired_ip:
            wired_ip = primary_address

    dns_servers = []
    for line in read_text("/etc/resolv.conf").splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[0] == "nameserver":
            dns_servers.append(parts[1].strip())

    gateway = ""
    route_output = run_command(["ip", "route", "show", "default"])
    for line in route_output.splitlines():
        parts = line.split()
        if not parts or parts[0] != "default":
            continue
        if "via" in parts:
            via_index = parts.index("via")
            if via_index + 1 < len(parts):
                gateway = parts[via_index + 1].strip()
                break

    return {
        "wired_ip": wired_ip,
        "wireless_ip": wireless_ip,
        "netbird_ip": netbird_ip,
        "dns": ", ".join(dns_servers),
        "gateway": gateway,
        "interface_stats": interface_stats,
    }


def collect_installed_software(limit):
    if limit <= 0:
        return []

    priority_terms = (
        "chrome",
        "google-chrome",
        "netbird",
        "anydesk",
        "rustdesk",
        "wps",
        "salt",
        "wazuh",
        "openscap",
        "scap",
        "clamav",
        "clamd",
        "freshclam",
    )
    source_entries = []

    install_dates = collect_dpkg_install_dates()

    apt_entries = collect_user_apt_packages(install_dates)
    if apt_entries:
        source_entries.append(apt_entries)

    snap_entries = []
    snap_output = run_command(["snap", "list"])
    if snap_output:
        for line in snap_output.splitlines()[1:]:
            fields = line.split()
            if not fields:
                continue
            snap_entries.append({
                "name": fields[0].strip(),
                "version": fields[1].strip() if len(fields) > 1 else "",
                "install_date": "",
                "source": "snap",
            })
    if snap_entries:
        source_entries.append(snap_entries)

    flatpak_entries = []
    flatpak_output = run_command(["flatpak", "list", "--app", "--columns=name,application,version"])
    if flatpak_output:
        for line in flatpak_output.splitlines():
            parts = line.split("\t")
            if not parts:
                continue
            app_name = parts[0].strip() if len(parts) > 0 else ""
            app_id = parts[1].strip() if len(parts) > 1 else ""
            version = parts[2].strip() if len(parts) > 2 else ""
            name = app_name or app_id
            if not name:
                continue
            flatpak_entries.append({
                "name": name,
                "version": version,
                "install_date": "",
                "source": "flatpak",
            })
    if flatpak_entries:
        source_entries.append(flatpak_entries)

    appimage_entries = []
    appimage_output = run_command(["find", str(Path.home()), "-name", "*.AppImage"], timeout=30)
    if appimage_output:
        for line in appimage_output.splitlines():
            app_path = line.strip()
            if not app_path:
                continue
            appimage_entries.append({
                "name": Path(app_path).name,
                "version": "",
                "install_date": "",
                "source": "appimage",
            })
    if appimage_entries:
        source_entries.append(appimage_entries)

    pip_entries = []
    pip_output = run_command(["pip3", "list", "--user", "--format=json"])
    if pip_output:
        try:
            for item in json.loads(pip_output):
                name = str(item.get("name", "")).strip()
                if not name:
                    continue
                pip_entries.append({
                    "name": name,
                    "version": str(item.get("version", "")).strip(),
                    "install_date": "",
                    "source": "pip",
                })
        except json.JSONDecodeError:
            pass
    if pip_entries:
        source_entries.append(pip_entries)

    npm_entries = []
    npm_output = run_command(["npm", "list", "-g", "--depth=0", "--json"], timeout=30)
    if npm_output:
        try:
            dependencies = json.loads(npm_output).get("dependencies", {})
            for name, item in dependencies.items():
                normalized_name = str(name or "").strip()
                if not normalized_name:
                    continue
                npm_entries.append({
                    "name": normalized_name,
                    "version": str((item or {}).get("version", "")).strip(),
                    "install_date": "",
                    "source": "npm",
                })
        except json.JSONDecodeError:
            pass
    if npm_entries:
        source_entries.append(npm_entries)

    cargo_entries = []
    cargo_output = run_command(["cargo", "install", "--list"], timeout=30)
    if cargo_output:
        for line in cargo_output.splitlines():
            if not line or line.startswith(" "):
                continue
            match = re.match(r"^(?P<name>[^\s]+)\s+v?(?P<version>[^:]+):$", line.strip())
            if not match:
                continue
            cargo_entries.append({
                "name": match.group("name").strip(),
                "version": match.group("version").strip(),
                "install_date": "",
                "source": "cargo",
            })
    if cargo_entries:
        source_entries.append(cargo_entries)

    prioritized = []
    regular = []
    seen = set()
    for entries in source_entries:
        for entry in entries:
            key = (entry.get("source", ""), entry.get("name", ""), entry.get("version", ""))
            if key in seen:
                continue
            seen.add(key)
            name = entry.get("name", "").strip().lower()
            if any(term in name for term in priority_terms):
                prioritized.append(entry)
            else:
                regular.append(entry)

    software = prioritized[:limit]
    if len(software) < limit:
        software.extend(regular[: limit - len(software)])
    return software


def collect_dpkg_install_dates():
    install_dates = {}
    log_paths = sorted(Path("/var/log").glob("dpkg.log*"))
    for log_path in log_paths:
        try:
            if log_path.suffix == ".gz":
                with gzip.open(log_path, "rt", encoding="utf-8", errors="ignore") as handle:
                    lines = handle
                    for line in lines:
                        match = DPKG_INSTALL_PATTERN.match(line)
                        if not match:
                            continue
                        install_dates[match.group(2).strip()] = match.group(1)
            else:
                for line in log_path.read_text(encoding="utf-8", errors="ignore").splitlines():
                    match = DPKG_INSTALL_PATTERN.match(line)
                    if not match:
                        continue
                    install_dates[match.group(2).strip()] = match.group(1)
        except OSError:
            continue
    return install_dates


def collect_user_apt_packages(install_dates):
    manual_output = run_command(["apt-mark", "showmanual"], timeout=20)
    if not manual_output:
        return []

    system_pkg_output = run_command([
        "apt-cache",
        "depends",
        "--recurse",
        "--no-recommends",
        "--no-suggests",
        "ubuntu-minimal",
        "ubuntu-standard",
        "ubuntu-desktop-minimal",
    ], timeout=30)
    system_packages = set()
    for line in system_pkg_output.splitlines():
        value = line.strip()
        if not value or value.startswith("<") or not re.match(r"^\w", value):
            continue
        system_packages.add(value)

    apt_query_output = run_command(["dpkg-query", "-W", "-f=${binary:Package}\t${Version}\n"], timeout=30)
    versions = {}
    for line in apt_query_output.splitlines():
        package, _, version = line.partition("\t")
        package = package.strip()
        if package:
            versions[package] = version.strip()

    entries = []
    for package in sorted({line.strip() for line in manual_output.splitlines() if line.strip()}):
        if package in system_packages:
            continue
        if USER_APT_EXCLUDE_PATTERN.search(package):
            continue
        entries.append({
            "name": package,
            "version": versions.get(package, ""),
            "install_date": install_dates.get(package, ""),
            "source": "apt",
        })
    return entries


def collect_clamav_report(scan_paths, timeout):
    scanner = shutil.which("clamscan") or shutil.which("clamdscan")
    if not scanner:
        return None

    resolved_paths = []
    for path in scan_paths:
        if not path:
            continue
        candidate = Path(path)
        if candidate.exists():
            resolved_paths.append(str(candidate))
    if not resolved_paths:
        resolved_paths = ["/"]

    command = [scanner, "--recursive", "--infected", *resolved_paths]
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as error:
        return {
            "source": "clamav",
            "status": "error",
            "severity": "warning",
            "title": "ClamAV scan failed",
            "summary": f"ClamAV scan failed before completion: {error}",
            "detail": str(error),
            "scanned_at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "scanned_paths": resolved_paths,
            "error_count": 1,
        }

    output_parts = [part for part in [result.stdout.strip(), result.stderr.strip()] if part]
    output = "\n".join(output_parts)
    infected_files = []
    summary = {}
    in_summary = False
    for line in output.splitlines():
        stripped = line.strip()
        if stripped == "----------- SCAN SUMMARY -----------":
            in_summary = True
            continue
        if in_summary:
            if ":" not in stripped:
                continue
            key, value = stripped.split(":", 1)
            summary[key.strip().lower()] = value.strip()
            continue
        if stripped.endswith(" FOUND") and ":" in stripped:
            infected_files.append(stripped.rsplit(":", 1)[0].strip())

    infected_count = parse_summary_count(summary.get("infected files", "")) or len(infected_files)
    scanned_count = parse_summary_count(summary.get("scanned files", ""))
    error_count = parse_summary_count(summary.get("total errors", ""))

    status = "clean"
    severity = "info"
    title = "ClamAV scan clean"
    if result.returncode == 1 or infected_count > 0:
        status = "infected"
        severity = "high"
        title = "ClamAV detected threats"
    elif result.returncode not in (0, 1):
        status = "error"
        severity = "warning"
        title = "ClamAV scan failed"

    summary_text = f"Scanned {scanned_count or 'unknown'} files; infected: {infected_count}; errors: {error_count}."
    detail_lines = []
    if output:
        detail_lines = output.splitlines()[-40:]

    return {
        "source": "clamav",
        "status": status,
        "severity": severity,
        "title": title,
        "summary": summary_text,
        "detail": "\n".join(detail_lines),
        "scanned_at": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "scanned_paths": resolved_paths,
        "infected_files": infected_files[:20],
        "scanned_file_count": scanned_count,
        "infected_file_count": infected_count,
        "error_count": error_count,
    }


def find_latest_openscap_result(results_dir):
    if not results_dir:
        return None
    base_dir = Path(results_dir)
    if not base_dir.exists():
        return None
    candidates = sorted(base_dir.glob("openscap-results-*.xml"), key=lambda path: path.stat().st_mtime, reverse=True)
    return candidates[0] if candidates else None


def local_name(tag):
    return tag.split("}", 1)[1] if tag.startswith("{") and "}" in tag else tag


def openscap_rule_result(element):
    result = element.attrib.get("result", "").strip().lower()
    if result:
        return result

    for child in element:
        if local_name(child.tag) != "result":
            continue
        text = (child.text or "").strip().lower()
        if text:
            return text

    return "unknown"


def collect_openscap_report(results_dir):
    latest_result = find_latest_openscap_result(results_dir)
    if latest_result is None:
        return None

    try:
        tree = ET.parse(latest_result)
        root = tree.getroot()
    except (ET.ParseError, OSError) as error:
        return {
            "source": "openscap",
            "status": "error",
            "severity": "warning",
            "title": "OpenSCAP hardening report unavailable",
            "summary": f"Failed to parse OpenSCAP result file {latest_result.name}.",
            "detail": str(error),
            "scanned_at": datetime.datetime.fromtimestamp(latest_result.stat().st_mtime, tz=datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        }

    benchmark_title = ""
    title_map = {}
    for element in root.iter():
        name = local_name(element.tag)
        if name == "Benchmark" and not benchmark_title:
            title_node = next((child for child in element if local_name(child.tag) == "title" and (child.text or "").strip()), None)
            if title_node is not None:
                benchmark_title = (title_node.text or "").strip()
        if name == "Rule":
            rule_id = element.attrib.get("id", "").strip()
            title_node = next((child for child in element if local_name(child.tag) == "title" and (child.text or "").strip()), None)
            if rule_id and title_node is not None:
                title_map[rule_id] = (title_node.text or "").strip()

    counts = {}
    failed_rules = []
    for element in root.iter():
        if local_name(element.tag) != "rule-result":
            continue
        result = openscap_rule_result(element)
        counts[result] = counts.get(result, 0) + 1
        if result not in {"fail", "error", "unknown"}:
            continue
        rule_id = element.attrib.get("idref", "").strip()
        rule_title = title_map.get(rule_id, "")
        failed_rules.append(f"{rule_id}: {rule_title}".strip(": "))

    fail_count = counts.get("fail", 0)
    error_count = counts.get("error", 0)
    pass_count = counts.get("pass", 0)
    informational_count = counts.get("informational", 0)
    notapplicable_count = counts.get("notapplicable", 0)
    notchecked_count = counts.get("notchecked", 0)
    fixed_count = counts.get("fixed", 0)
    total_rules = sum(counts.values())
    status = "compliant"
    severity = "info"
    title = "OpenSCAP hardening check passed"
    if fail_count > 0:
        status = "noncompliant"
        severity = "medium"
        title = "OpenSCAP hardening findings"
    elif error_count > 0:
        status = "error"
        severity = "warning"
        title = "OpenSCAP hardening scan failed"

    summary = (
        f"Rules checked: {total_rules}; passed: {pass_count}; failed: {fail_count}; errors: {error_count}; "
        f"not-applicable: {notapplicable_count}; informational: {informational_count}; not-checked: {notchecked_count}; fixed: {fixed_count}."
    )
    detail_lines = []
    if benchmark_title:
        detail_lines.append(benchmark_title)
    detail_lines.append(summary)
    if failed_rules:
        detail_lines.append("Top failed rules:")
        detail_lines.extend(f"- {item}" for item in failed_rules[:20])

    report_file = latest_result.with_name(latest_result.name.replace("results", "report").replace(".xml", ".html"))
    scanned_at = datetime.datetime.fromtimestamp(latest_result.stat().st_mtime, tz=datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return {
        "source": "openscap",
        "status": status,
        "severity": severity,
        "title": title,
        "summary": summary,
        "detail": "\n".join(detail_lines),
        "scanned_at": scanned_at,
        "scanned_paths": [str(results_dir)],
        "scanned_file_count": total_rules,
        "infected_file_count": fail_count,
        "error_count": error_count,
        "artifact_files": [str(latest_result)] + ([str(report_file)] if report_file.exists() else []),
    }


def normalize_endpoint(server_url):
    parsed = urllib.parse.urlparse(server_url)
    if not parsed.scheme:
        server_url = f"http://{server_url}"
        parsed = urllib.parse.urlparse(server_url)

    if parsed.path.endswith("/api/inventory-sync/ingest"):
        return server_url

    base_path = parsed.path.rstrip("/")
    endpoint_path = f"{base_path}/api/inventory-sync/ingest" if base_path else "/api/inventory-sync/ingest"
    normalized = parsed._replace(path=endpoint_path, params="", query="", fragment="")
    return urllib.parse.urlunparse(normalized)


def build_asset_payload(args):
    hostname = collect_hostname()
    os_name, os_version, kernel, architecture, os_build = collect_os_details()
    source_fingerprint = args.source_fingerprint or collect_source_fingerprint()
    asset_tag = args.asset_tag or build_default_asset_tag(hostname, source_fingerprint)
    manufacturer = collect_manufacturer()
    model = collect_model()
    serial_number = collect_serial_number()
    category = infer_asset_category(args.category, manufacturer, model)
    salt_minion_id = args.salt_minion_id or collect_salt_minion_id()
    wazuh_agent_id = args.wazuh_agent_id or collect_wazuh_agent_id()
    network_details = collect_network_details()
    volume_details = collect_volume_details()
    asset_payload = {
        "asset_tag": asset_tag,
        "name": args.name or hostname,
        "hostname": hostname,
        "category": category,
        "is_compute": True,
        "serial_number": serial_number,
        "manufacturer": manufacturer,
        "model": model,
        "entity_id": args.entity_id,
        "dept_id": args.dept_id,
        "location_id": args.location_id,
        "assigned_to_email": args.assigned_to_email,
        "assigned_to_name": args.assigned_to_name,
        "employee_code": args.employee_code,
        "department_name": args.department_name,
        "purchase_date": args.purchase_date,
        "warranty_until": args.warranty_until,
        "status": args.status,
        "condition": args.condition,
        "source_fingerprint": source_fingerprint,
        "salt_minion_id": salt_minion_id,
        "wazuh_agent_id": wazuh_agent_id,
        "notes": args.notes,
        "compute_details": {
            "processor": collect_processor(),
            "ram": collect_memory(),
            "storage": collect_storage(),
            "gpu": collect_gpu(),
            "display": collect_display(args.use_hardinfo_fallback),
            "bios_version": collect_bios_version(),
            "mac_address": collect_primary_mac_address(),
            "os_name": os_name,
            "os_version": os_version,
            "kernel": kernel,
            "architecture": architecture,
            "os_build": os_build,
            "last_boot": collect_last_boot(),
            "last_seen": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "logged_in_users": collect_logged_in_users(),
            "pending_updates": collect_pending_updates(),
            "pending_update_details": collect_pending_update_details(),
            "anydesk_id": collect_remote_access_id("anydesk"),
            "rustdesk_id": collect_remote_access_id("rustdesk"),
            "disk_layout": collect_disk_layout(),
            "volumes": volume_details,
        },
        "network": network_details,
        "installed_software": [] if args.no_software_scan else collect_installed_software(args.software_limit),
    }
    security_reports = []
    if args.include_clamav_report:
        clamav_report = collect_clamav_report(args.clamav_scan_paths, args.clamav_timeout)
        if clamav_report:
            security_reports.append(clamav_report)
    if args.include_openscap_report:
        openscap_report = collect_openscap_report(args.openscap_results_dir)
        if openscap_report:
            security_reports.append(openscap_report)
    if security_reports:
        asset_payload["security_reports"] = security_reports

    payload = {
        "assets": [
            asset_payload
        ]
    }
    return payload


def post_payload(endpoint, token, payload, timeout):
    data = json.dumps(payload).encode("utf-8")
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        request = urllib.request.Request(
            endpoint,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status, response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == max_attempts:
                raise
        except urllib.error.URLError:
            if attempt == max_attempts:
                raise

        time.sleep(min(2 ** (attempt - 1), 4))


def parse_args():
    parser = argparse.ArgumentParser(description="Collect hardware and OS details from a Linux system and push them to the ITMS backend.")
    parser.add_argument("--server-url", default=os.getenv("ITMS_SERVER_URL", "http://localhost:3001"), help="Backend base URL or full ingest endpoint")
    parser.add_argument("--token-file", default="", help="Read the inventory ingest token from FILE")
    parser.add_argument("--prompt-token", action="store_true", help="Prompt for the inventory ingest token without echo")
    parser.add_argument("--asset-tag", default=os.getenv("ITMS_ASSET_TAG", ""), help="Asset tag to report. Defaults to hostname plus a stable device suffix")
    parser.add_argument("--name", default=os.getenv("ITMS_ASSET_NAME", ""), help="Friendly asset name. Defaults to hostname")
    parser.add_argument("--category", default=os.getenv("ITMS_ASSET_CATEGORY", "auto"), help="Asset category such as auto, laptop, desktop, vm, or server")
    parser.add_argument("--assigned-to-email", default=os.getenv("ITMS_ASSIGNED_TO_EMAIL", ""), help="Employee email to link the asset to")
    parser.add_argument("--assigned-to-name", default=os.getenv("ITMS_ASSIGNED_TO_NAME", ""), help="Employee name for enrollment review")
    parser.add_argument("--employee-code", default=os.getenv("ITMS_EMPLOYEE_CODE", ""), help="Employee ID for enrollment review")
    parser.add_argument("--department-name", default=os.getenv("ITMS_DEPARTMENT_NAME", ""), help="Department name for enrollment review")
    parser.add_argument("--entity-id", default=os.getenv("ITMS_ENTITY_ID", ""), help="Optional entity UUID")
    parser.add_argument("--dept-id", default=os.getenv("ITMS_DEPT_ID", ""), help="Optional department UUID")
    parser.add_argument("--location-id", default=os.getenv("ITMS_LOCATION_ID", ""), help="Optional location UUID")
    parser.add_argument("--purchase-date", default=os.getenv("ITMS_PURCHASE_DATE", ""), help="Optional purchase date in YYYY-MM-DD")
    parser.add_argument("--warranty-until", default=os.getenv("ITMS_WARRANTY_UNTIL", ""), help="Optional warranty date in YYYY-MM-DD")
    parser.add_argument("--status", default=os.getenv("ITMS_ASSET_STATUS", "in_use"), help="Asset status to report")
    parser.add_argument("--condition", default=os.getenv("ITMS_ASSET_CONDITION", "good"), help="Asset condition to report")
    parser.add_argument("--source-fingerprint", default=os.getenv("ITMS_SOURCE_FINGERPRINT", ""), help="Stable device fingerprint. Defaults to machine-id or hardware UUID")
    parser.add_argument("--salt-minion-id", default=os.getenv("ITMS_SALT_MINION_ID", ""), help="Optional Salt minion ID override")
    parser.add_argument("--wazuh-agent-id", default=os.getenv("ITMS_WAZUH_AGENT_ID", ""), help="Optional Wazuh agent ID")
    parser.add_argument("--notes", default=os.getenv("ITMS_ASSET_NOTES", "Imported from system collector"), help="Freeform asset notes")
    parser.add_argument("--software-limit", type=int, default=int(os.getenv("ITMS_SOFTWARE_LIMIT", "200")), help="Maximum number of installed packages to include")
    parser.add_argument("--no-software-scan", action="store_true", help="Skip installed software collection")
    parser.add_argument("--include-clamav-report", action="store_true", default=env_flag("ITMS_INCLUDE_CLAMAV_REPORT"), help="Run a ClamAV scan and include the report in the payload")
    parser.add_argument("--clamav-scan-path", action="append", dest="clamav_scan_paths", default=env_list("ITMS_CLAMAV_SCAN_PATHS"), help="Path to include in the ClamAV scan. Can be passed multiple times")
    parser.add_argument("--clamav-timeout", type=int, default=int(os.getenv("ITMS_CLAMAV_TIMEOUT", "3600")), help="Maximum ClamAV scan runtime in seconds")
    parser.add_argument("--include-openscap-report", action="store_true", default=env_flag("ITMS_INCLUDE_OPENSCAP_REPORT"), help="Attach the latest OpenSCAP result summary from the configured results directory")
    parser.add_argument("--openscap-results-dir", default=os.getenv("ITMS_OPENSCAP_RESULTS_DIR", "/var/lib/itms/openscap"), help="Directory containing OpenSCAP result files")
    parser.add_argument("--use-hardinfo-fallback", action="store_true", default=env_flag("ITMS_USE_HARDINFO_FALLBACK"), help="Use hardinfo report parsing as a fallback for display details when available")
    parser.add_argument("--print-only", action="store_true", help="Print JSON payload instead of sending it")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds")
    return parser.parse_args()


def main():
    args = parse_args()
    token = ""
    if args.token_file:
        token = read_value_file(args.token_file)
    elif args.prompt_token:
        token = read_secret_prompt("Inventory ingest token")
    else:
        token = (os.getenv("ITMS_INGEST_TOKEN", "") or "").strip()
        if not token:
            token = env_file_value("ITMS_INGEST_TOKEN")

    payload = build_asset_payload(args)

    if args.print_only:
        json.dump(payload, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    if not token:
        sys.stderr.write("Missing ingest token. Set ITMS_INGEST_TOKEN, use --token-file, use --prompt-token, or rely on /etc/itms-agent.env.\n")
        return 1

    endpoint = normalize_endpoint(args.server_url)
    try:
        status_code, response_body = post_payload(endpoint, token, payload, args.timeout)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="ignore")
        sys.stderr.write(f"Inventory push failed with HTTP {error.code}: {body}\n")
        return 1
    except urllib.error.URLError as error:
        sys.stderr.write(f"Inventory push failed: {error}\n")
        return 1

    sys.stdout.write(f"Inventory push succeeded with HTTP {status_code}.\n")
    if response_body:
        try:
            parsed = json.loads(response_body)
            json.dump(parsed, sys.stdout, indent=2)
            sys.stdout.write("\n")
        except json.JSONDecodeError:
            sys.stdout.write(response_body + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
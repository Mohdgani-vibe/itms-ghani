#!/usr/bin/env python3

import argparse
import getpass
import json
import os
import shlex
import socket
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


DEFAULT_CATEGORIES = ["laptop", "desktop", "workstation"]


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


def shell_quote(value):
    return shlex.quote(str(value or ""))


def read_value_file(path):
    file_path = Path(path).expanduser()
    if not file_path.is_file():
        fail(f"Value file not found: {file_path}")
    return file_path.read_text(encoding="utf-8").rstrip("\r\n")


def read_secret_prompt(label):
    if sys.stdin.isatty() or sys.stderr.isatty():
        return getpass.getpass(f"{label}: ").strip()

    value = sys.stdin.readline()
    if not value:
        fail(f"Cannot read {label} from stdin.")
    return value.rstrip("\r\n")


def resolve_secret(explicit_value, file_path, prompt, label):
    if file_path:
        return read_value_file(file_path)
    if prompt:
        return read_secret_prompt(label)
    return (explicit_value or "").strip()


def api_request(base_url, path, token, method="GET", payload=None, timeout=30):
    body = None
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        urllib.parse.urljoin(base_url.rstrip("/") + "/", path.lstrip("/")),
        data=body,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else None


def login(base_url, email, password, timeout):
    response = api_request(base_url, "/api/auth/login", "", method="POST", payload={"email": email, "password": password}, timeout=timeout)
    token = (response or {}).get("token", "")
    if not token:
        raise RuntimeError("login did not return a token")
    return token


def sanitize_host(value):
    value = (value or "").strip()
    if "/" in value:
        value = value.split("/", 1)[0].strip()
    return value


def build_linux_bootstrap_command(server_url, asset, salt_master, wazuh_manager):
    installer_url = urllib.parse.urljoin(server_url.rstrip("/") + "/", "installers/install-itms-agent.sh")
    command_parts = [
        "curl -fsSL",
        shell_quote(installer_url),
        "| sudo bash -s --",
        "--server-url",
        shell_quote(server_url),
        "--prompt-token",
        "--category",
        shell_quote(asset.get("category") or "laptop"),
    ]
    if asset.get("asset_tag"):
        command_parts.extend(["--asset-tag", shell_quote(asset["asset_tag"])])
    if asset.get("name"):
        command_parts.extend(["--name", shell_quote(asset["name"])])
    if salt_master:
        command_parts.extend(["--salt-master", shell_quote(salt_master)])
    if wazuh_manager:
        command_parts.extend(["--wazuh-manager", shell_quote(wazuh_manager)])
    return " ".join(command_parts)


def run_ssh_inventory(host, ssh_user, ssh_key_path, server_url, ingest_token, script_path, timeout):
    known_hosts_path = os.getenv("ITMS_SSH_KNOWN_HOSTS", "").strip()
    remote_command = ["python3", "-", "--server-url", server_url]
    bootstrap = (
        "import os\n"
        f"os.environ['ITMS_INGEST_TOKEN'] = {ingest_token!r}\n"
    ).encode("utf-8")
    with open(script_path, "rb") as handle:
        remote_script = bootstrap + handle.read()
        ssh_command = [
            "ssh",
            "-o",
            "BatchMode=yes",
            "-o",
            f"ConnectTimeout={timeout}",
            "-o",
            "StrictHostKeyChecking=yes",
            "-i",
            ssh_key_path,
        ]
        if known_hosts_path:
            ssh_command.extend([
                "-o",
                f"UserKnownHostsFile={os.path.expanduser(known_hosts_path)}",
            ])
        ssh_command.extend([
            f"{ssh_user}@{host}",
            *remote_command,
        ])
        result = subprocess.run(
            ssh_command,
            input=remote_script,
            capture_output=True,
            text=False,
            timeout=timeout + 20,
            check=False,
        )
    stdout = (result.stdout or b"").decode("utf-8", errors="replace")
    stderr = (result.stderr or b"").decode("utf-8", errors="replace")
    return result.returncode == 0, (stdout or stderr).strip()


def main():
    parser = argparse.ArgumentParser(description="Refresh inventory for all laptop/desktop/workstation assets using Salt or SSH.")
    parser.add_argument("--server-url", default=os.getenv("ITMS_SERVER_URL", "http://YOUR_SERVER_IP"))
    parser.add_argument("--token-file", default="")
    parser.add_argument("--prompt-token", action="store_true")
    parser.add_argument("--email", default=os.getenv("ITMS_EMAIL", ""))
    parser.add_argument("--password-file", default="")
    parser.add_argument("--prompt-password", action="store_true")
    parser.add_argument("--ingest-token-file", default="")
    parser.add_argument("--prompt-ingest-token", action="store_true")
    parser.add_argument("--ssh-user", default=os.getenv("ITMS_SSH_USER", "itteam"))
    parser.add_argument("--ssh-key", default=os.getenv("ITMS_SSH_KEY", "/home/itteam/.ssh/id_ed25519"))
    parser.add_argument("--ssh-known-hosts", default=os.getenv("ITMS_SSH_KNOWN_HOSTS", ""))
    parser.add_argument("--categories", default=",".join(DEFAULT_CATEGORIES))
    parser.add_argument("--timeout", type=int, default=5)
    parser.add_argument("--api-timeout", type=int, default=int(os.getenv("ITMS_API_TIMEOUT", "120")))
    parser.add_argument("--salt-master", default=os.getenv("ITMS_SALT_MASTER", "YOUR_SERVER_IP"))
    parser.add_argument("--wazuh-manager", default=os.getenv("ITMS_WAZUH_MANAGER", "YOUR_SERVER_IP"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    auth_token = resolve_secret(os.getenv("ITMS_TOKEN", ""), args.token_file, args.prompt_token, "API auth token")
    password = resolve_secret(os.getenv("ITMS_PASSWORD", ""), args.password_file, args.prompt_password, "API password")
    ingest_token = resolve_secret(os.getenv("ITMS_INGEST_TOKEN", ""), args.ingest_token_file, args.prompt_ingest_token, "Inventory ingest token")

    if not auth_token and (not args.email or not password):
        fail("Provide an API auth token via ITMS_TOKEN, --token-file, or --prompt-token, or set both --email and a password via env/file/prompt.")
    if not ingest_token:
        fail("Provide an ingest token via ITMS_INGEST_TOKEN, --ingest-token-file, or --prompt-ingest-token before running this script.")
    if args.ssh_known_hosts:
        os.environ["ITMS_SSH_KNOWN_HOSTS"] = args.ssh_known_hosts

    token = auth_token or login(args.server_url, args.email, password, args.api_timeout)
    categories = {item.strip().lower() for item in args.categories.split(",") if item.strip()}
    local_script = str((Path(__file__).resolve().parent / "push-system-inventory.py"))

    assets = api_request(args.server_url, "/api/assets", token, timeout=args.api_timeout) or []
    targets = [asset for asset in assets if (asset.get("category") or "").strip().lower() in categories]

    results = []
    for asset in targets:
        asset_id = asset.get("id", "")
        asset_tag = asset.get("asset_tag", "")
        hostname = (asset.get("hostname") or "").strip()
        salt_minion_id = (asset.get("salt_minion_id") or "").strip()
        try:
            detail = api_request(args.server_url, f"/api/assets/{asset_id}", token, timeout=args.api_timeout) or {}
        except (urllib.error.URLError, TimeoutError, socket.timeout) as error:
            detail = {}
            results.append({
                "asset_tag": asset_tag,
                "status": "warning",
                "method": "api",
                "error": f"detail lookup failed: {error}",
            })
        network = detail.get("network") or {}
        host_candidates = []
        for candidate in [
            network.get("netbird_ip"),
            network.get("wired_ip"),
            network.get("wireless_ip"),
            hostname,
        ]:
            normalized = sanitize_host(str(candidate or ""))
            if normalized and normalized not in host_candidates:
                host_candidates.append(normalized)

        if args.dry_run:
            action = "salt-refresh" if salt_minion_id else "ssh-refresh" if host_candidates else "blocked"
            preview = {"asset_tag": asset_tag, "action": action, "host_candidates": host_candidates, "salt_minion_id": salt_minion_id}
            if not salt_minion_id:
                preview["bootstrap_command"] = build_linux_bootstrap_command(
                    args.server_url,
                    asset,
                    args.salt_master,
                    args.wazuh_manager,
                )
            results.append(preview)
            continue

        if salt_minion_id:
            try:
                response = api_request(
                    args.server_url,
                    f"/api/assets/{asset_id}/script",
                    token,
                    method="POST",
                    payload={"script": "refresh_inventory"},
                    timeout=args.api_timeout,
                )
                results.append({"asset_tag": asset_tag, "status": "queued", "method": "salt", "response": response})
                continue
            except urllib.error.HTTPError as error:
                detail_text = error.read().decode("utf-8", errors="ignore")
                results.append({"asset_tag": asset_tag, "status": "failed", "method": "salt", "error": detail_text or str(error)})
                continue
            except (urllib.error.URLError, TimeoutError, socket.timeout) as error:
                results.append({"asset_tag": asset_tag, "status": "failed", "method": "salt", "error": str(error)})
                continue

        refreshed = False
        for host in host_candidates:
            ok, output = run_ssh_inventory(host, args.ssh_user, args.ssh_key, args.server_url, ingest_token, local_script, args.timeout)
            if ok:
                results.append({"asset_tag": asset_tag, "status": "completed", "method": "ssh", "host": host, "output": output})
                refreshed = True
                break
        if not refreshed:
            results.append({
                "asset_tag": asset_tag,
                "status": "blocked",
                "method": "none",
                "host_candidates": host_candidates,
                "error": "No Salt link or reachable SSH host available.",
                "bootstrap_command": build_linux_bootstrap_command(
                    args.server_url,
                    asset,
                    args.salt_master,
                    args.wazuh_manager,
                ),
            })

    print(json.dumps({"categories": sorted(categories), "results": results}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
#!/usr/bin/env bash
set -euo pipefail

# poker-clock bootstrap
# - Installs Docker on Ubuntu/Debian (optional)
# - Ensures server/config.json exists (optional overwrite)
# - Optionally syncs BASE_PATH across prod files
# - Starts docker compose (dev or prod)

MODE="prod"              # prod|dev
BASE_PATH="/pokerklokke" # no trailing slash
FORCE_CONFIG="0"
INSTALL_DOCKER="auto"    # auto|yes|no
DETACH="1"

usage() {
  cat <<'EOF'
Usage:
  ./bootstrap.sh [--prod|--dev] [--base-path /pokerklokke] [--force-config]
               [--install-docker auto|yes|no] [--foreground]

Defaults:
  --prod
  --base-path /pokerklokke
  --install-docker auto

Examples:
  ./bootstrap.sh
  ./bootstrap.sh --prod --base-path /pokerklokke
  ./bootstrap.sh --dev
  ./bootstrap.sh --prod --force-config
EOF
}

log() { printf '\n[%s] %s\n' "$(date +'%H:%M:%S')" "$*"; }

die() { echo "ERROR: $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

is_linux() { [[ "${OSTYPE:-}" == linux* ]] || [[ "$(uname -s 2>/dev/null || true)" == "Linux" ]]; }

is_root() { [[ "$(id -u)" -eq 0 ]]; }

sudo_if_needed() {
  if is_root; then
    "$@"
  else
    sudo "$@"
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prod) MODE="prod"; shift ;;
      --dev) MODE="dev"; shift ;;
      --base-path)
        [[ $# -ge 2 ]] || die "--base-path requires a value"
        BASE_PATH="$2"; shift 2
        ;;
      --force-config) FORCE_CONFIG="1"; shift ;;
      --install-docker)
        [[ $# -ge 2 ]] || die "--install-docker requires auto|yes|no"
        INSTALL_DOCKER="$2"; shift 2
        ;;
      --foreground) DETACH="0"; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "Unknown arg: $1 (use --help)" ;;
    esac
  done

  # normalize base path
  if [[ "$MODE" == "prod" ]]; then
    [[ "$BASE_PATH" == /* ]] || die "--base-path must start with / (e.g. /pokerklokke)"
    [[ "$BASE_PATH" != */ ]] || BASE_PATH="${BASE_PATH%/}"
    [[ "$BASE_PATH" != "" ]] || die "--base-path cannot be empty in prod"
  else
    BASE_PATH="" # dev uses root routing
  fi
}

install_docker_ubuntu_debian() {
  require_cmd curl

  log "Installing Docker Engine + Compose plugin (apt)"

  sudo_if_needed apt-get update -y
  sudo_if_needed apt-get install -y ca-certificates curl gnupg
  sudo_if_needed install -m 0755 -d /etc/apt/keyrings

  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo_if_needed gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo_if_needed chmod a+r /etc/apt/keyrings/docker.gpg
  fi

  # Detect distro codename
  local codename
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
  local distro
  distro="$(. /etc/os-release && echo "${ID}")"

  # Docker repo URL differs by distro. Ubuntu + Debian are both supported.
  local repo_distro="$distro"
  if [[ "$distro" != "ubuntu" && "$distro" != "debian" ]]; then
    die "Unsupported distro for docker install: $distro"
  fi

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${repo_distro} ${codename} stable" \
    | sudo_if_needed tee /etc/apt/sources.list.d/docker.list >/dev/null

  sudo_if_needed apt-get update -y
  sudo_if_needed apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  sudo_if_needed systemctl enable --now docker >/dev/null 2>&1 || true

  if ! is_root; then
    if getent group docker >/dev/null 2>&1; then
      sudo_if_needed usermod -aG docker "$USER" || true
      log "Added $USER to docker group (log out/in to apply)"
    fi
  fi
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    return 0
  fi

  if [[ "$INSTALL_DOCKER" == "no" ]]; then
    die "Docker is not installed (and --install-docker no was set)"
  fi

  if ! is_linux; then
    die "Docker not found. On non-Linux, install Docker Desktop manually."
  fi

  if [[ ! -f /etc/os-release ]]; then
    die "Cannot detect Linux distro (missing /etc/os-release)"
  fi

  local distro
  distro="$(. /etc/os-release && echo "${ID}")"

  if [[ "$distro" == "ubuntu" || "$distro" == "debian" ]]; then
    install_docker_ubuntu_debian
  else
    die "Auto-install Docker only supports Ubuntu/Debian. Install Docker manually for: $distro"
  fi
}

sync_base_path_prod_files() {
  [[ "$MODE" == "prod" ]] || return 0

  log "Syncing BASE_PATH across prod files (BASE_PATH=${BASE_PATH})"

  require_cmd python3

  python3 - <<PY
import re
from pathlib import Path

base_path = "${BASE_PATH}"
vite_base = base_path + "/"

# docker-compose.prod.yml
p = Path('docker-compose.prod.yml')
text = p.read_text(encoding='utf-8')
text2 = text
text2 = re.sub(r'(VITE_BASE_PATH:\s*)/[^\s]*/', r'\\1' + vite_base, text2)
text2 = re.sub(r'(\bBASE_PATH=)/[^\s\"]+', r'\\1' + base_path, text2)
if text2 != text:
    p.write_text(text2, encoding='utf-8')

# traefik/prod/poker-clock.yml
p = Path('traefik/prod/poker-clock.yml')
text = p.read_text(encoding='utf-8')
text2 = re.sub(r'PathPrefix\(`[^`]*`\)', f"PathPrefix(`{base_path}`)", text)
if text2 != text:
    p.write_text(text2, encoding='utf-8')
PY
}

ensure_server_config() {
  local example="server/config.example.json"
  local target="server/config.json"

  if [[ ! -f "$example" ]]; then
    log "No $example found; skipping config generation"
    return 0
  fi

  if [[ -f "$target" && "$FORCE_CONFIG" != "1" ]]; then
    log "$target already exists; leaving it as-is (use --force-config to overwrite)"
    return 0
  fi

  log "Generating $target from $example"
  require_cmd python3

  python3 - <<PY
import json, secrets
from pathlib import Path

example = Path('server/config.example.json')
target = Path('server/config.json')

cfg = json.loads(example.read_text(encoding='utf-8'))

cfg['basePath'] = "${BASE_PATH}"

# Generate fresh secrets every time we (re)create config
cfg['jwtSecret'] = secrets.token_urlsafe(48)
cfg['sessionSecret'] = secrets.token_urlsafe(48)

target.write_text(json.dumps(cfg, indent=2) + "\n", encoding='utf-8')
PY
}

compose_up() {
  require_cmd docker

  if ! docker compose version >/dev/null 2>&1; then
    die "Docker Compose plugin not available. Install docker-compose-plugin (Linux) or update Docker Desktop."
  fi

  local args=(up --build)
  if [[ "$DETACH" == "1" ]]; then
    args+=( -d )
  fi

  if [[ "$MODE" == "prod" ]]; then
    log "Starting production stack (docker-compose.prod.yml)"
    docker compose -f docker-compose.prod.yml "${args[@]}"
    log "Prod started. URLs (local): http://localhost:8080  (Traefik dashboard: http://localhost:8081)"
  else
    log "Starting development stack (docker-compose.yml)"
    docker compose -f docker-compose.yml "${args[@]}"
    log "Dev started. URLs (local): http://localhost:8080  (Traefik dashboard: http://localhost:8081)"
  fi
}

main() {
  parse_args "$@"

  log "Mode: $MODE"
  if [[ "$MODE" == "prod" ]]; then
    log "Base path: $BASE_PATH"
  fi

  ensure_docker
  ensure_server_config
  sync_base_path_prod_files
  compose_up

  if [[ "$INSTALL_DOCKER" != "no" && ! is_root && is_linux ]]; then
    if id -nG "$USER" 2>/dev/null | grep -q '\bdocker\b'; then
      :
    else
      log "NOTE: If you got permission errors with docker, log out/in (docker group) or rerun with sudo."
    fi
  fi
}

main "$@"

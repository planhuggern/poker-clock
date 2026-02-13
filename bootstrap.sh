#!/usr/bin/env bash
set -euo pipefail

# poker-clock bootstrap
# - Installs Docker on Ubuntu/Debian (optional)
# - Ensures server/config.json exists (optional overwrite)
# - Optionally syncs BASE_PATH across prod files
# - Starts docker compose (dev or prod)

# - Installs git and clones repo if project directory is missing


MODE="prod"              # prod|dev
BASE_PATH="/pokerklokke" # no trailing slash
FORCE_CONFIG="0"
INSTALL_DOCKER="auto"    # auto|yes|no
DETACH="1"
DEFAULT_GIT_URL="https://github.com/planhuggern/poker-clock.git"
PROJECT_DIR="poker-clock"
CLONE="0"

usage() {
  cat <<'EOF'
Usage:
  ./bootstrap.sh [--prod|--dev] [--base-path /pokerklokke] [--force-config]
               [--install-docker auto|yes|no] [--foreground]
               [--clone]

Defaults:
  --prod
  --base-path /pokerklokke
  --install-docker auto

Examples:
  ./bootstrap.sh
  ./bootstrap.sh --prod --base-path /pokerklokke
  ./bootstrap.sh --dev
  ./bootstrap.sh --prod --force-config
  ./bootstrap.sh --clone
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
      --clone) CLONE="1"; shift ;;
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

  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL "https://download.docker.com/linux/${repo_distro}/gpg" | sudo_if_needed gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo_if_needed chmod a+r /etc/apt/keyrings/docker.gpg
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

  BASE_PATH="$BASE_PATH" python3 - <<'PY'
import os
import re
from pathlib import Path

base_path = os.environ.get('BASE_PATH', '').rstrip('/')
vite_base = base_path + "/"


def update_compose_prod(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    lines = text.splitlines(True)

    out: list[str] = []
    in_args = False
    args_indent: int | None = None
    args_child_indent: int | None = None

    for line in lines:
        # Update env var BASE_PATH in list form
        line = re.sub(r'(\s*-\s*BASE_PATH=)/[^\s\"]+', r'\1' + base_path, line)

        m_args = re.match(r'^(\s*)args:\s*(#.*)?$', line)
        if m_args:
            in_args = True
            args_indent = len(m_args.group(1))
            args_child_indent = args_indent + 2
            out.append(line)
            continue

        if in_args:
            if line.strip() == "":
                out.append(line)
                continue

            current_indent = len(line) - len(line.lstrip(' '))
            if current_indent <= (args_indent or 0):
                in_args = False
                args_indent = None
                args_child_indent = None
                out.append(line)
                continue

            # Normalize VITE_BASE_PATH, regardless of mapping or list style
            if re.match(r'^\s*-\s*VITE_BASE_PATH=', line):
                out.append(' ' * (args_child_indent or 0) + f"VITE_BASE_PATH: {vite_base}\n")
                continue

            if re.match(r'^\s*VITE_BASE_PATH:\s*', line):
                out.append(' ' * (args_child_indent or 0) + f"VITE_BASE_PATH: {vite_base}\n")
                continue

        out.append(line)

    new_text = ''.join(out)
    if new_text != text:
        path.write_text(new_text, encoding='utf-8')


def update_traefik_rule(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    new_text = re.sub(r'PathPrefix\(`[^`]*`\)', f"PathPrefix(`{base_path}`)", text)
    if new_text != text:
        path.write_text(new_text, encoding='utf-8')


update_compose_prod(Path('docker-compose.prod.yml'))
update_traefik_rule(Path('traefik/prod/poker-clock.yml'))
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

  BASE_PATH="$BASE_PATH" python3 - <<'PY'
import json, secrets
import os
from pathlib import Path

example = Path('server/config.example.json')
target = Path('server/config.json')

cfg = json.loads(example.read_text(encoding='utf-8'))

cfg['basePath'] = os.environ.get('BASE_PATH', '')

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

  # If not running from project root, clone repo
  if [[ ! -f "docker-compose.prod.yml" ]]; then
    if [[ -d "$PROJECT_DIR" ]]; then
      log "Project root not found in current folder; using existing ./$PROJECT_DIR"
      cd "$PROJECT_DIR"
    else
      log "Project directory not found. Installing git and cloning repo."
      if ! command -v git >/dev/null 2>&1; then
        log "Installing git..."
        sudo_if_needed apt-get update -y
        sudo_if_needed apt-get install -y git
      fi
      git clone "$DEFAULT_GIT_URL" "$PROJECT_DIR"
      cd "$PROJECT_DIR"
      log "Repo cloned. Continuing bootstrap in $PROJECT_DIR."
    fi
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

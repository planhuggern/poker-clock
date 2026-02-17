#!/usr/bin/env bash
set -euo pipefail

# Minimal native (non-Docker) Traefik bootstrap for Ubuntu/Debian.
#
# Første steg: klon eller oppdater dette repoet fra GitHub (HTTPS)

GIT_REPO="https://github.com/planhuggern/poker-clock.git"  # Sett til riktig repo-URL
REPO_DIR="$HOME/poker-clock"
#
# What it does:
# - Installs Traefik binary (from GitHub releases)
# - Writes static config: /etc/traefik/traefik.yml
# - Writes dynamic config: /etc/traefik/dynamic/dynamic.yml
# - Writes systemd unit: /etc/systemd/system/traefik.service
# - Enables + starts Traefik
#
# Default backend is Django/Gunicorn on http://127.0.0.1:8000

DOMAIN=""                 # e.g. example.com
ACME_EMAIL=""             # e.g. you@example.com
BACKEND_URL="http://127.0.0.1:8000"
BASE_PATH="/"             # "/" or "/pokerklokke" (no trailing slash)
TRAEFIK_VERSION="latest"  # 'latest' for automatisk, eller angi f.eks. v3.6.8

TRAEFIK_USER="traefik"
TRAEFIK_GROUP="traefik"

usage() {
  cat <<'EOF'
Usage:
  sudo ./bootstrap.sh --domain example.com --email you@example.com \
    [--backend-url http://127.0.0.1:8000] [--base-path /]

Notes:
  - This is a native/systemd Traefik setup (no Docker).
  - Opens ports 80/443 via Traefik; ensure your firewall allows them.
  - ACME uses HTTP-01 challenge on port 80.

Examples:
  sudo ./bootstrap.sh --domain example.com --email you@example.com
  sudo ./bootstrap.sh --domain example.com --email you@example.com --backend-url http://127.0.0.1:8000
  sudo ./bootstrap.sh --domain example.com --email you@example.com --base-path /pokerklokke
EOF
}

log() { printf '\n[%s] %s\n' "$(date +'%H:%M:%S')" "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"; }

is_linux() { [[ "${OSTYPE:-}" == linux* ]] || [[ "$(uname -s 2>/dev/null || true)" == "Linux" ]]; }
is_root() { [[ "$(id -u)" -eq 0 ]]; }

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain)
        [[ $# -ge 2 ]] || die "--domain requires a value (e.g. example.com)"
        DOMAIN="$2"; shift 2
        ;;
      --email|--acme-email)
        [[ $# -ge 2 ]] || die "--email requires a value (e.g. you@example.com)"
        ACME_EMAIL="$2"; shift 2
        ;;
      --backend-url)
        [[ $# -ge 2 ]] || die "--backend-url requires a value (e.g. http://127.0.0.1:8000)"
        BACKEND_URL="$2"; shift 2
        ;;
      --base-path)
        [[ $# -ge 2 ]] || die "--base-path requires a value (e.g. / or /pokerklokke)"
        BASE_PATH="$2"; shift 2
        ;;
      -h|--help) usage; exit 0 ;;
      *) die "Unknown arg: $1 (use --help)" ;;
    esac
  done

  # normalize/validate
  DOMAIN="${DOMAIN#http://}"
  DOMAIN="${DOMAIN#https://}"
  DOMAIN="${DOMAIN%%/*}"
  [[ -n "$DOMAIN" ]] || die "--domain is required (set via --domain or ~/.env)"
  [[ -n "$ACME_EMAIL" ]] || die "--email is required (set via --email or ~/.env)"

  [[ "$BASE_PATH" == /* ]] || die "--base-path must start with /"
  [[ "$BASE_PATH" != */ ]] || BASE_PATH="${BASE_PATH%/}"
  [[ -n "$BASE_PATH" ]] || BASE_PATH="/"
}

detect_arch() {
  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) die "Unsupported architecture: $arch" ;;
  esac
}

ensure_user_and_dirs() {
  log "Ensuring traefik user + directories"
  if ! id -u "$TRAEFIK_USER" >/dev/null 2>&1; then
    useradd --system --home /var/lib/traefik --shell /usr/sbin/nologin "$TRAEFIK_USER"
  fi
  if ! getent group "$TRAEFIK_GROUP" >/dev/null 2>&1; then
    groupadd --system "$TRAEFIK_GROUP" || true
  fi
  usermod -a -G "$TRAEFIK_GROUP" "$TRAEFIK_USER" || true

  install -d -m 0755 /etc/traefik
  install -d -m 0755 /etc/traefik/dynamic
  install -d -m 0750 -o "$TRAEFIK_USER" -g "$TRAEFIK_GROUP" /var/lib/traefik
  install -d -m 0750 -o "$TRAEFIK_USER" -g "$TRAEFIK_GROUP" /var/log/traefik
}

install_traefik() {
  require_cmd curl
  require_cmd tar
  local arch
  arch="$(detect_arch)"
  local tmp
  tmp="$(mktemp -d)"

  local version="$TRAEFIK_VERSION"
  if [[ "$version" == "" || "$version" == "latest" ]]; then
    log "Henter siste Traefik-versjon fra GitHub..."
    version="v$(curl -fsSL https://api.github.com/repos/traefik/traefik/releases/latest | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/' | sed 's/^v//')"
    log "Siste versjon er $version"
  fi

  log "Installing Traefik ${version}"

  # Finn riktig filnavn for v2 og v3
  local name
  if [[ "$version" =~ ^v3 ]]; then
    name="traefik_${version#v}_linux-${arch}.tar.gz"
  else
    name="traefik_${version#v}_linux_${arch}.tar.gz"
  fi
  local url="https://github.com/traefik/traefik/releases/download/${version}/${name}"
  
  log "Henter Traefik fra $url..."

  curl -fsSL "$url" -o "$tmp/$name"
  tar -xzf "$tmp/$name" -C "$tmp"
  install -m 0755 "$tmp/traefik" /usr/local/bin/traefik

  rm -rf "$tmp"
}

write_configs() {
  log "Writing Traefik config to /etc/traefik"

  # Static config
  cat > /etc/traefik/traefik.yml <<EOF
entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

providers:
  file:
    directory: "/etc/traefik/dynamic"
    watch: true

certificatesResolvers:
  letsencrypt:
    acme:
      email: "${ACME_EMAIL}"
      storage: "/var/lib/traefik/acme.json"
      httpChallenge:
        entryPoint: web

log:
  level: INFO

accessLog: {}
EOF

  # Dynamic config: single router -> backend
  # If BASE_PATH != /, we strip it before proxying.
  local strip_mw=""
  if [[ "$BASE_PATH" != "/" ]]; then
    strip_mw="strip-basepath"
  fi

  cat > /etc/traefik/dynamic/dynamic.yml <<EOF
http:
  routers:
    app:
      rule: "Host(\`${DOMAIN}\`) && PathPrefix(\`${BASE_PATH}\`)"
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      service: backend
EOF

  if [[ -n "$strip_mw" ]]; then
    cat >> /etc/traefik/dynamic/dynamic.yml <<EOF
      middlewares:
        - ${strip_mw}
EOF
  fi

  cat >> /etc/traefik/dynamic/dynamic.yml <<EOF

  services:
    backend:
      loadBalancer:
        servers:
          - url: "${BACKEND_URL}"
EOF

  if [[ -n "$strip_mw" ]]; then
    cat >> /etc/traefik/dynamic/dynamic.yml <<EOF

  middlewares:
    strip-basepath:
      stripPrefix:
        prefixes:
          - "${BASE_PATH}"
EOF
  fi

  # Ensure ACME storage exists and is private
  if [[ ! -f /var/lib/traefik/acme.json ]]; then
    install -m 0600 -o "$TRAEFIK_USER" -g "$TRAEFIK_GROUP" /dev/null /var/lib/traefik/acme.json
  fi
}

write_systemd_unit() {
  log "Writing systemd unit"
  cat > /etc/systemd/system/traefik.service <<'EOF'
[Unit]
Description=Traefik
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=traefik
Group=traefik
ExecStart=/usr/local/bin/traefik --configFile=/etc/traefik/traefik.yml
Restart=on-failure
RestartSec=2
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now traefik
}

load_env_vars() {
  # Finn hjemmemappen til brukeren som startet sudo, ellers bruk $HOME
  local user_home
  if [[ -n "$SUDO_USER" && "$SUDO_USER" != "root" ]]; then
    user_home="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
  else
    user_home="$HOME"
  fi
  local env_file="$user_home/.env"
  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    source "$env_file"
    if [[ -z "$DOMAIN" && -n "$domain" ]]; then DOMAIN="$domain"; fi
    if [[ -z "$ACME_EMAIL" && -n "$email" ]]; then ACME_EMAIL="$email"; fi
    if [[ -z "$DOMAIN" && -n "$DOMAIN" ]]; then DOMAIN="$DOMAIN"; fi
    if [[ -z "$ACME_EMAIL" && -n "$ACME_EMAIL" ]]; then ACME_EMAIL="$ACME_EMAIL"; fi
  fi
}

main() {
  # Klon eller oppdater repoet først
  require_cmd git
  if [ ! -d "$REPO_DIR/.git" ]; then
    log "Kloner repoet fra $GIT_REPO til $REPO_DIR"
    git clone "$GIT_REPO" "$REPO_DIR"
  else
    log "Oppdaterer repoet i $REPO_DIR (git pull)"
    git -C "$REPO_DIR" pull --ff-only
  fi

  load_env_vars
  parse_args "$@"

  is_linux || die "This script is for Linux (Ubuntu/Debian)"
  is_root || die "Run as root (use sudo)"

  require_cmd systemctl

  ensure_user_and_dirs
  install_traefik
  write_configs
  write_systemd_unit

  log "Done. Traefik is running."
  log "Router: https://${DOMAIN}${BASE_PATH} -> ${BACKEND_URL}"
  sudo netstat -tuln
}


main "$@"
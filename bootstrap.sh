#!/usr/bin/env bash
set -euo pipefail

# Minimal native (non-Docker) Traefik + Django bootstrap for Ubuntu/Debian.
#
# Første steg: klon eller oppdater dette repoet fra GitHub (HTTPS)

GIT_REPO="https://github.com/planhuggern/poker-clock.git"  # Sett til riktig repo-URL
# Bruk hjemmemappen til brukeren som startet sudo, ikke root
if [[ -n "${SUDO_USER:-}" && "$SUDO_USER" != "root" ]]; then
  REAL_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
else
  REAL_HOME="$HOME"
fi
REPO_DIR="$REAL_HOME/poker-clock"
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

APP_USER=""   # settes automatisk til SUDO_USER

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

ensure_traefik_bind_caps() {
  [[ -x /usr/local/bin/traefik ]] || return 0

  # La Traefik (som ikke-root) binde til port 80/443
  if ! command -v setcap >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      log "Installerer libcap2-bin (setcap)"
      apt-get update -y
      apt-get install -y libcap2-bin
    fi
  fi
  command -v setcap >/dev/null 2>&1 || die "Missing command: setcap (install libcap2-bin)"
  setcap 'cap_net_bind_service=+ep' /usr/local/bin/traefik
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

  # Sjekk om riktig versjon allerede er installert
  if [[ -x /usr/local/bin/traefik ]]; then
    log "Traefik er allerede installert. Sjekker versjon..."
    local current_version
    current_version="$(/usr/local/bin/traefik version 2>/dev/null | awk '/^Version:/{print $2}' | head -1)"
    log "Nåværende versjon: $current_version"
    if [[ -n "$current_version" && "$current_version" == "${version#v}" ]]; then
      log "Traefik ${version} er allerede installert. Hopper over nedlasting."
      ensure_traefik_bind_caps
      rm -rf "$tmp"
      return
    fi
  fi

  log "Installerer Traefik ${version}"

  # Finn riktig filnavn for v2 og v3 (både v2 og v3 bruker understrek)
  local name
  name="traefik_${version}_linux_${arch}.tar.gz"
  local url="https://github.com/traefik/traefik/releases/download/${version}/${name}"

  log "Henter Traefik fra $url..."

  curl -fsSL "$url" -o "$tmp/$name"
  tar -xzf "$tmp/$name" -C "$tmp"
  install -m 0755 "$tmp/traefik" /usr/local/bin/traefik

  ensure_traefik_bind_caps

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
  traefik:
    address: ":8080"

api:
  dashboard: true
  insecure: true  # Kun for testing! Ikke bruk i produksjon uten autentisering.

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
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ExecStart=/usr/local/bin/traefik --configFile=/etc/traefik/traefik.yml
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now traefik
  sleep 2
  systemctl is-active --quiet traefik \
    && log "Traefik service: active" \
    || { log "ADVARSEL: Traefik service er IKKE aktiv. Sjekk: systemctl status traefik"; systemctl status traefik --no-pager || true; }
}

load_env_vars() {
  local env_file="$REAL_HOME/.env"
  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    source "$env_file"
    if [[ -z "$DOMAIN" && -n "$domain" ]]; then DOMAIN="$domain"; fi
    if [[ -z "$ACME_EMAIL" && -n "$email" ]]; then ACME_EMAIL="$email"; fi
    if [[ -z "$DOMAIN" && -n "$DOMAIN" ]]; then DOMAIN="$DOMAIN"; fi
    if [[ -z "$ACME_EMAIL" && -n "$ACME_EMAIL" ]]; then ACME_EMAIL="$ACME_EMAIL"; fi
  fi
}

setup_django() {
  local server_dir="$REPO_DIR/server"
  local venv_dir="$server_dir/.venv"

  log "Setter opp Python venv i $venv_dir"

  # Sørg for at data-mappen finnes (SQLite)
  install -d -m 0750 -o "$APP_USER" "$server_dir/data"

  # Sørg for at python3, venv og pip er tilgjengelig
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y -q
    apt-get install -y -q python3 python3-venv python3-pip
  elif ! command -v python3 >/dev/null 2>&1; then
    die "python3 ikke funnet og apt-get ikke tilgjengelig"
  fi

  # Lag venv hvis den ikke finnes, eller re-lag hvis pip mangler (kan skje etter feilet første kjøring)
  if [[ ! -x "$venv_dir/bin/python" ]] || [[ ! -x "$venv_dir/bin/pip" ]]; then
    rm -rf "$venv_dir"
    sudo -u "$APP_USER" python3 -m venv "$venv_dir"
  fi

  log "Installerer Python-avhengigheter"
  sudo -u "$APP_USER" "$venv_dir/bin/pip" install --quiet --upgrade pip
  sudo -u "$APP_USER" "$venv_dir/bin/pip" install --quiet -r "$server_dir/requirements.txt"

  log "Kjører Django-migrasjoner"
  sudo -u "$APP_USER" \
    BASE_PATH="$BASE_PATH" \
    SQLITE_FILE="$server_dir/data/pokerclock.sqlite" \
    "$venv_dir/bin/python" "$server_dir/manage.py" migrate --run-syncdb

  # Sørg for at Node.js / npm er installert
  if ! command -v npm >/dev/null 2>&1; then
    log "Installerer Node.js (LTS) via NodeSource..."
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y nodejs
  else
    log "Node $(node --version) / npm $(npm --version) allerede installert"
  fi

  # Bygg React
  local client_dir="$REPO_DIR/client-react"
  local public_dir="$server_dir/public"
  log "Bygger React-klienten"
  sudo -u "$APP_USER" bash -c "cd '$client_dir' && npm install --silent && npm run build --silent"
  install -d -m 0755 "$public_dir"
  cp -r "$client_dir/dist/." "$public_dir/"
  log "React-build kopiert til $public_dir"
}

write_django_systemd_unit() {
  local server_dir="$REPO_DIR/server"
  local venv_dir="$server_dir/.venv"

  log "Skriver systemd-unit for poker-clock (Daphne)"

  cat > /etc/systemd/system/poker-clock.service <<EOF
[Unit]
Description=Poker Clock (Django/Daphne)
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${server_dir}
Environment="BASE_PATH=${BASE_PATH}"
Environment="SQLITE_FILE=${server_dir}/data/pokerclock.sqlite"
Environment="DJANGO_SETTINGS_MODULE=poker_clock.settings"
ExecStart=${venv_dir}/bin/daphne -b 127.0.0.1 -p 8000 poker_clock.asgi:application
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable poker-clock
  systemctl restart poker-clock
  sleep 2
  systemctl is-active --quiet poker-clock \
    && log "poker-clock service: active" \
    || { log "ADVARSEL: poker-clock er IKKE aktiv. Sjekk: systemctl status poker-clock"; systemctl status poker-clock --no-pager || true; }
}

main() {
  # Bestem app-bruker (den som kjørte sudo) – trengs tidlig for chown
  if [[ -n "${SUDO_USER:-}" && "$SUDO_USER" != "root" ]]; then
    APP_USER="$SUDO_USER"
  else
    APP_USER="$(logname 2>/dev/null || echo root)"
  fi

  # Klon eller oppdater repoet først
  require_cmd git
  if [ ! -d "$REPO_DIR/.git" ]; then
    log "Kloner repoet fra $GIT_REPO til $REPO_DIR"
    sudo -u "$APP_USER" git clone "$GIT_REPO" "$REPO_DIR"
  else
    log "Oppdaterer repoet i $REPO_DIR (git reset --hard + pull)"
    # Sørg for at eierskap er riktig før git-operasjoner
    chown -R "$APP_USER":"$APP_USER" "$REPO_DIR"
    sudo -u "$APP_USER" git -C "$REPO_DIR" reset --hard HEAD
    sudo -u "$APP_USER" git -C "$REPO_DIR" pull --ff-only
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
  setup_django
  write_django_systemd_unit

  log "Ferdig."
  log "  Traefik:     https://${DOMAIN}${BASE_PATH}"
  log "  Django app:  http://127.0.0.1:8000  (via Traefik -> HTTPS)"
  log "  Logg:        journalctl -u poker-clock -f"
  sleep 1
  netstat -tuln
}


main "$@"
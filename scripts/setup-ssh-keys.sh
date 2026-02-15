#!/usr/bin/env bash
set -euo pipefail

KEY_NAME="id_ed25519_poker_clock"
COMMENT=""
FORCE=0
ADD_TO_AGENT=1
CONFIG_HOST=""
CONFIG_USER=""
CONFIG_HOSTNAME=""

usage() {
  cat <<'EOF'
Usage:
  ./scripts/setup-ssh-keys.sh [options]

Options:
  --key-name NAME        Default: id_ed25519_poker_clock
  --comment TEXT         Key comment (e.g. your email)
  --force                Overwrite existing key files
  --no-agent             Do not run ssh-agent / ssh-add
  --config-host HOST     Append a Host block to ~/.ssh/config
  --config-user USER     Optional user for the Host block
  --config-hostname NAME Optional HostName (defaults to --config-host)
  -h, --help             Show help

Examples:
  ./scripts/setup-ssh-keys.sh --comment you@example.com
  ./scripts/setup-ssh-keys.sh --config-host my-vps --config-user ubuntu --config-hostname 1.2.3.4
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --key-name) KEY_NAME="$2"; shift 2;;
    --comment) COMMENT="$2"; shift 2;;
    --force) FORCE=1; shift;;
    --no-agent) ADD_TO_AGENT=0; shift;;
    --config-host) CONFIG_HOST="$2"; shift 2;;
    --config-user) CONFIG_USER="$2"; shift 2;;
    --config-hostname) CONFIG_HOSTNAME="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1;;
  esac
done

command -v ssh-keygen >/dev/null 2>&1 || { echo "Missing ssh-keygen (install OpenSSH)" >&2; exit 1; }

SSH_DIR="$HOME/.ssh"
KEY_PATH="$SSH_DIR/$KEY_NAME"
PUB_PATH="$KEY_PATH.pub"
CONFIG_PATH="$SSH_DIR/config"

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR" || true

if [[ -e "$KEY_PATH" || -e "$PUB_PATH" ]]; then
  if [[ "$FORCE" -ne 1 ]]; then
    echo "Key already exists: $KEY_PATH (use --force to overwrite)" >&2
    exit 1
  fi
  rm -f "$KEY_PATH" "$PUB_PATH"
fi

comment_args=()
if [[ -n "$COMMENT" ]]; then
  comment_args=( -C "$COMMENT" )
fi

echo "Generating SSH key: $KEY_PATH"
ssh-keygen -t ed25519 -a 64 -f "$KEY_PATH" "${comment_args[@]}"

chmod 600 "$KEY_PATH" || true
chmod 644 "$PUB_PATH" || true

if [[ "$ADD_TO_AGENT" -eq 1 ]]; then
  if command -v ssh-add >/dev/null 2>&1; then
    if [[ -z "${SSH_AUTH_SOCK:-}" ]]; then
      eval "$(ssh-agent -s)" >/dev/null
    fi
    echo "Adding key to ssh-agent"
    ssh-add "$KEY_PATH" >/dev/null
  else
    echo "ssh-add not found; skipping ssh-agent" >&2
  fi
fi

if [[ -n "$CONFIG_HOST" ]]; then
  [[ -n "$CONFIG_HOSTNAME" ]] || CONFIG_HOSTNAME="$CONFIG_HOST"
  echo "Appending Host '$CONFIG_HOST' to $CONFIG_PATH"
  {
    echo ""
    echo "Host $CONFIG_HOST"
    echo "  HostName $CONFIG_HOSTNAME"
    if [[ -n "$CONFIG_USER" ]]; then
      echo "  User $CONFIG_USER"
    fi
    echo "  IdentityFile $KEY_PATH"
    echo "  AddKeysToAgent yes"
  } >> "$CONFIG_PATH"
fi

echo ""
echo "Public key ($PUB_PATH):"
cat "$PUB_PATH"
echo ""
echo "Next step: add the public key where you need it (GitHub / server authorized_keys)."
Param(
  [string]$KeyName = "id_ed25519_poker_clock",
  [string]$Comment = "",
  [switch]$Force,
  [switch]$NoAgent,
  [switch]$NoClipboard,
  [string]$ConfigHost = "",
  [string]$ConfigUser = "",
  [string]$ConfigHostName = ""
)

$ErrorActionPreference = "Stop"

try {
  $OutputEncoding = [System.Text.Encoding]::UTF8
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
  # best-effort; continue even if we can't change encoding
}

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Info([string]$Message) {
  Write-Host $Message
}

# Resolve paths (PowerShell variables are case-insensitive; avoid $home/$HOME collision)
$homeDir = $HOME
if (-not $homeDir) { $homeDir = [Environment]::GetFolderPath("UserProfile") }
$sshDir = Join-Path $homeDir ".ssh"
$keyPath = Join-Path $sshDir $KeyName
$pubPath = "$keyPath.pub"
$configPath = Join-Path $sshDir "config"

$AddToAgent = -not $NoAgent
$CopyPublicKeyToClipboard = -not $NoClipboard

# Ensure ssh-keygen exists
$sshKeygen = Get-Command ssh-keygen -ErrorAction SilentlyContinue
if (-not $sshKeygen) {
  Fail "Fant ikke 'ssh-keygen'. På Windows: Settings → Apps → Optional features → installer 'OpenSSH Client'."
}

# Ensure .ssh directory
if (-not (Test-Path $sshDir)) {
  New-Item -ItemType Directory -Path $sshDir | Out-Null
}

# Existing key guard
if ((Test-Path $keyPath) -or (Test-Path $pubPath)) {
  if (-not $Force) {
    Fail "Nøkkel finnes allerede: $keyPath (bruk -Force for å overskrive)"
  }
  Remove-Item -Force -ErrorAction SilentlyContinue $keyPath, $pubPath
}

# Generate key (ed25519)
# Passphrase: prompt (ssh-keygen will prompt). Comment is optional.
$commentArg = @()
if ($Comment -and $Comment.Trim().Length -gt 0) {
  $commentArg = @("-C", $Comment)
}

Info "Genererer SSH-nøkkel: $keyPath"
& $sshKeygen.Source -t ed25519 -a 64 -f $keyPath @commentArg | Out-Null

# Start/enable ssh-agent (Windows service)
if ($AddToAgent) {
  $svc = Get-Service -Name "ssh-agent" -ErrorAction SilentlyContinue
  if (-not $svc) {
    Info "Advarsel: 'ssh-agent' service finnes ikke. Hopper over ssh-agent-oppsett."
  } else {
    if ($svc.StartType -ne "Automatic") {
      Set-Service -Name "ssh-agent" -StartupType Automatic
    }
    if ($svc.Status -ne "Running") {
      Start-Service -Name "ssh-agent"
    }

    $sshAdd = Get-Command ssh-add -ErrorAction SilentlyContinue
    if (-not $sshAdd) {
      Fail "Fant ikke 'ssh-add'. Sørg for at OpenSSH Client er installert."
    }

    Info "Legger nøkkelen til ssh-agent"
    & $sshAdd.Source $keyPath | Out-Null
  }
}

# Optionally update ~/.ssh/config
if ($ConfigHost -and $ConfigHost.Trim().Length -gt 0) {
  if (-not $ConfigHostName) { $ConfigHostName = $ConfigHost }

  $lines = @()
  if (Test-Path $configPath) {
    $lines = Get-Content -Path $configPath -ErrorAction SilentlyContinue
  }

  # Append a new Host block (simple; avoids trying to surgically edit existing blocks)
  $block = @(
    "",
    "Host $ConfigHost",
    "  HostName $ConfigHostName",
    $(if ($ConfigUser) { "  User $ConfigUser" } else { $null }),
    "  IdentityFile $keyPath",
    "  AddKeysToAgent yes"
  ) | Where-Object { $_ -ne $null }

  Info "Oppdaterer SSH config: $configPath (legger til Host '$ConfigHost')"
  ($lines + $block) | Set-Content -Path $configPath -Encoding utf8
}

# Print public key
if (-not (Test-Path $pubPath)) {
  Fail "Public key ble ikke funnet: $pubPath"
}

$pubKey = Get-Content -Raw -Path $pubPath
Info "\nPublic key ($pubPath):\n$pubKey"

# Copy to clipboard (best-effort)
if ($CopyPublicKeyToClipboard) {
  $setClipboard = Get-Command Set-Clipboard -ErrorAction SilentlyContinue
  if ($setClipboard) {
    $pubKey | Set-Clipboard
    Info "Public key er kopiert til clipboard."
  } else {
    Info "Kunne ikke kopiere til clipboard (Set-Clipboard ikke tilgjengelig)."
  }
}

Info "\nNeste steg: legg public key inn der du skal bruke den (f.eks. GitHub / server: ~/.ssh/authorized_keys)."
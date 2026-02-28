# poker-clock
Enkel pokerklokke. Backend: Django + Channels (Python). Frontend: React (Vite).

## Serverstruktur

```
server/           ← Django-app (Python)
  poker_clock/    ← Django-prosjekt (settings, asgi, urls)
  clock/          ← Django-app (state, consumers, views, models)
  manage.py
  requirements.txt
  config.json     ← konfig (JWT, Google OAuth, adminEmails osv.)

client-react/     ← React + Vite
```

## Lokalt dev

```bash
# Backend
cd server
python -m venv .venv
.venv/bin/pip install -r requirements.txt   # Linux/macOS
# .venv\Scripts\pip install -r requirements.txt  # Windows
python manage.py migrate
DEBUG=true python manage.py runserver "[::]:8000"  # [::] sikrer IPv4+IPv6 på Windows

# Frontend (ny terminal)
cd client-react
npm install
npm run dev
```

Dev-login uten Google OAuth — åpne dette i nettleseren og du blir logget inn automatisk:
```
http://localhost:8000/auth/dev?role=admin
```

WebSocket: `ws://localhost:8000/ws/clock/?token=<jwt>`

## server/config.json

```json
{
  "jwtSecret": "...",
  "clientOrigin": "http://localhost:8081",
  "serverOrigin": "http://localhost:8000",
  "google": {
    "clientID": "",
    "clientSecret": "",
    "callbackURL": "http://localhost:8000/auth/google/callback"
  },
  "adminEmails": ["deg@example.com"],
  "sqlite_file": "./data/pokerclock.sqlite"
}
```

Se `server/config.example.json` for mal.

## Produksjon (VPS med Traefik)

### 1. Bootstrap Traefik + Django (én gang)

Kopier scriptet og kjør det på VPS-en:

```bash
scp bootstrap.sh vps:~/
ssh vps
sudo ./bootstrap.sh --domain espen.holtebu.eu --email espen.holtebu@gmail.com
```

Scriptet gjør alt i én operasjon:
- Installerer Traefik som systemd-tjeneste (port 80/443, Let's Encrypt)
- Oppretter Python venv i `~/poker-clock/server/.venv`
- Installerer `requirements.txt`
- Kjører Django-migrasjoner
- Bygger React-klienten (hvis npm er tilgjengelig)
- Starter `poker-clock.service` (Daphne på `127.0.0.1:8000`)

Ved re-deploy er det bare å kjøre samme kommando igjen — repo pulles, venv oppdateres, og tjenesten restartes automatisk.

Sjekk logg:
```bash
journalctl -u poker-clock -f
journalctl -u traefik -f
```

### Basepath

Basepath kan settes via `BASE_PATH`-env eller `basePath` i `config.json`.  
Det må matche tre steder:
- `config.json`: `"basePath": "/pokerklokke"`
- React build: `VITE_BASE_PATH=/pokerklokke/` (satt i Vite-config / build-arg)
- Traefik rule: `PathPrefix('/pokerklokke')`

## Traefik dashboard

Port 8080 er ikke eksponert i brannmuren. Bruk SSH-tunneling:

**Windows (PowerShell):**
```powershell
Start-Job { ssh -L 8080:localhost:8080 vps -N }
# Stopp tunnelen når du er ferdig:
Stop-Job 1; Remove-Job 1
```

**Linux/macOS:**
```bash
ssh -L 8080:localhost:8080 vps -N &
# Stopp tunnelen:
kill %1
```

Åpne: http://localhost:8080/dashboard/

> URL-en må ha trailing slash (`/dashboard/`), ellers gir Traefik 404.

## SSH-nøkler (valgfritt)

**Windows:**
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-ssh-keys.ps1 `
  -Comment "you@example.com" -ConfigHost vps -ConfigUser espenhoh -ConfigHostName espen.holtebu.eu
```

**Linux/macOS:**
```bash
./scripts/setup-ssh-keys.sh --comment you@example.com
```

Kopier nøkkelen til VPS:
```bash
Get-Content $env:USERPROFILE\.ssh\id_ed25519_poker_clock.pub | ssh espenhoh@espen.holtebu.eu `
  "mkdir -p ~/.ssh; chmod 700 ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys"
```

## Deaktiver passord-innlogging (VPS)

```bash
sudo nano /etc/ssh/sshd_config.d/00-disable-password.conf
```
```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
```
```bash
sudo sshd -t && sudo systemctl restart ssh
```

## Sett opp firewall (VPS)

```bash
sudo apt update && sudo apt install ufw
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```


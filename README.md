# poker-clock
Enkel pokerklokke. Backend: Django + Channels (Python). Frontend: React (Vite).

## Serverstruktur

```
server/
  portal/           ← Django-prosjekt (nøytral container)
    settings.py     ← konfig, ALLOWED_HOSTS, SECRET_KEY, BASE_PATH
    urls.py         ← register_spa("poker-clock", "clock.urls") — legg ny app her
    asgi.py         ← HTTP + WebSocket routing
  clock/            ← Django-app: poker-clock
    consumers.py    ← WebSocket-consumer
    views.py        ← Auth (Google OAuth, dev-login)
    state.py        ← Klokketilstand (thread-safe)
    tick.py         ← Bakgrunnstråd som sender tick ~1/sek
    models.py       ← AppState (SQLite singleton)
    urls.py         ← /auth/google, /auth/google/callback, /auth/dev
    routing.py      ← WebSocket URL-mønster
  public/           ← WhiteNoise serverer dette som statiske filer
    poker-clock/    ← React-build (VITE_BASE_PATH=/poker-clock/)
      index.html
      assets/
  config.json       ← konfig (JWT, Google OAuth, adminEmails osv.)
  manage.py

client-react/       ← React + Vite (frontend)
```

### Legge til en ny app

1. Lag en ny Django-app: `python manage.py startapp my_app`
2. Legg til i `portal/settings.py` under `INSTALLED_APPS`
3. Registrer i `portal/urls.py`: `*register_spa("my-app", "my_app.urls")`
4. WebSocket (valgfritt): importer `websocket_urlpatterns` i `portal/asgi.py`
5. Bygg frontend til `server/public/my-app/` med `VITE_BASE_PATH=/my-app/`

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

```bash
scp bootstrap.sh vps:~/
ssh vps
sudo ./bootstrap.sh \
  --domain espen.holtebu.eu \
  --email espen.holtebu@gmail.com \
  --base-path /pokerklokke
```

Scriptet gjør alt i én operasjon:
- Installerer Traefik som systemd-tjeneste (port 80/443, Let's Encrypt)
- Skriver `/etc/traefik/dynamic/poker-clock.yml` (berører ikke andres konfig)
- Oppretter Python venv og installerer `requirements.txt`
- Kjører Django-migrasjoner
- Bygger React-klienten med `VITE_BASE_PATH=/pokerklokke/`
- Kopierer build til `~/poker-clock/server/public/pokerklokke/`
- Starter `poker-clock.service` (Daphne på `127.0.0.1:8000`)

### 2. Opprett config.json på VPS (første gang)

Bootstrap-scriptet oppretter ikke `config.json` (den er gitignored og inneholder secrets).
Lag den manuelt på VPS-en:

```bash
cat > ~/poker-clock/server/config.json <<'EOF'
{
  "jwtSecret": "<generer med: python3 -c 'import secrets; print(secrets.token_hex(50))'>",
  "djangoSecret": "<en annen lang tilfeldig streng>",

  "clientOrigin": "https://espen.holtebu.eu",
  "serverOrigin": "https://espen.holtebu.eu",
  "basePath": "/pokerklokke",

  "google": {
    "clientID": "<fra GCP Console>",
    "clientSecret": "<fra GCP Console>",
    "callbackURL": "https://espen.holtebu.eu/pokerklokke/auth/google/callback"
  },

  "adminEmails": ["espen.holtebu@gmail.com"],
  "sqlite_file": "./data/pokerclock.sqlite"
}
EOF
sudo systemctl restart poker-clock
```

**GCP Console:** Legg til `https://espen.holtebu.eu/pokerklokke/auth/google/callback`
som autorisert redirect-URI under *APIs & Services → Credentials*.

### 3. Re-deploy (ved oppdateringer)

Bootstrap-scriptet er idempotent — kjør den samme kommandoen igjen:

```bash
ssh vps
sudo ./bootstrap.sh \
  --domain espen.holtebu.eu \
  --email espen.holtebu@gmail.com \
  --base-path /pokerklokke
```

Repo pulles, venv oppdateres, React bygges og tjenesten restartes automatisk.

Sjekk logg:
```bash
journalctl -u poker-clock -f
journalctl -u traefik -f
```

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


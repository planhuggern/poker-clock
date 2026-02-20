# poker-clock
enkel pokerklokke

## SSH keys (valgfritt)

Eksempel (Windows):
- `powershell -ExecutionPolicy Bypass -File .\scripts\setup-ssh-keys.ps1 -Comment "you@example.com"`

Eksempel (Linux/macOS):
- `./scripts/setup-ssh-keys.sh --comment you@example.com`


Hvis du trenger å generere SSH-nøkkel, ligger det scripts her:

- Windows (PowerShell): `./scripts/setup-ssh-keys.ps1`
```
powershell -NoProfile -ExecutionPolicy Bypass -File setup-ssh-keys.ps1 -Comment "espenhoh@espen.holtebu.eu" -ConfigHost poker-vps -ConfigUser espenhoh -ConfigHostName espen.holtebu.eu

Get-Content $env:USERPROFILE\.ssh\id_ed25519_poker_clock.pub | ssh espenhoh@espen.holtebu.eu "mkdir -p ~/.ssh; chmod 700 ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys"
```

## Deaktivere passwordpålogging og root:
Lag en fil som kommer FØR 50-cloud-init.conf:
`sudo nano /etc/ssh/sshd_config.d/00-disable-password.conf`

Med
```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
```

Til slutt:
```
sudo sshd -t
sudo systemctl restart ssh
```

## Sette opp firewall:
```
sudo apt update && sudo apt install ufw
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```


## Traefik dashboard (native/bootstrap)

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
# Stopp tunnelen når du er ferdig:
kill %1
```

Åpne deretter: http://localhost:8080/dashboard/

> **Merk:** URL-en må ha trailing slash (`/dashboard/`), ellers gir Traefik 404.

## Bootstrap (fra scratch)

Dette repoet har en enkel bootstrap som kan settes opp på en fresh Ubuntu VPS.

- VPS (prod, én container, Traefik + app): `./bootstrap.sh --prod`
- VPS (prod, HTTPS): `./bootstrap.sh --prod --domain <ditt-domene> --acme-email <din-epost>`
- Lokalt (dev, 2 containere, Traefik + client/server): `./bootstrap.sh --dev`

Tips:
- over før enkelt til vps: `scp bootstrap.sh espenhoh@espen.holtebu.eu:~/` så `chmod +x ~/bootstrap.sh` og `~/bootstrap.sh`
- På Linux: `chmod +x bootstrap.sh` første gang.
- Prod basepath kan endres: `./bootstrap.sh --prod --base-path /pokerklokke`
- `server/config.json` blir bare generert hvis den mangler (bruk `--force-config` for å overskrive).

Lokalt dev (Docker Compose):
- Start: `docker compose -f docker-compose.yml up --build`
- App: http://localhost:8080
- Dev-login uten Google OAuth (kun i dev): http://localhost:8080/pokerklokke/auth/dev?role=admin

## Dev Container (VS Code)

Åpne repoet i VS Code → "Dev Containers: Reopen in Container". Da får du Node 20 + docker-cli i containeren (koblet til host-docker), og dependencies installeres automatisk.

## Produksjon (én container)

Bygger React til statiske filer og lar Node/Express-serveren serve dem (SPA-fallback), slik at du kan kjøre alt i én container bak Traefik.

- Start: `docker compose -f docker-compose.prod.yml up --build`
- App: https://<ditt-domene>/pokerklokke
- Traefik dashboard: http://localhost:8081

HTTPS (Let's Encrypt):
- Sett `TRAEFIK_ACME_EMAIL` på serveren før oppstart (f.eks. i `.env` ved siden av compose-filen), ellers får Traefik ikke hentet sertifikat.
- Alternativt: bruk bootstrap: `./bootstrap.sh --prod --domain <ditt-domene> --acme-email <din-epost>` (skriver `.env` automatisk og syncer Google callback/origins).
- Sørg for at DNS for domenet peker til VPS-en, og at port 80 og 443 er åpne i brannmur/security group.

Merk:
- Traefik-ruting for denne appen ligger i `traefik/prod/poker-clock.yml` og bruker `PathPrefix('/pokerklokke')`.
- Basepath må matche på 3 steder:
	- Traefik rule: `/pokerklokke`
	- `docker-compose.prod.yml`: `BASE_PATH=/pokerklokke`
	- build-arg til React: `VITE_BASE_PATH=/pokerklokke/`
- `docker-compose.prod.yml` monterer `server/config.json` inn i containeren. I ekte prod bør denne leveres som secret/volume (ikke bake den inn i image).

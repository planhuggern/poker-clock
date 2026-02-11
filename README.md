# poker-clock
enkel pokerklokke

## Bootstrap (fra scratch)

Dette repoet har en enkel bootstrap som kan settes opp på en fresh Ubuntu VPS.

- VPS (prod, én container, Traefik + app): `./bootstrap.sh --prod`
- Lokalt (dev, 2 containere, Traefik + client/server): `./bootstrap.sh --dev`

Tips:
- På Linux: `chmod +x bootstrap.sh` første gang.
- Prod basepath kan endres: `./bootstrap.sh --prod --base-path /pokerklokke`
- `server/config.json` blir bare generert hvis den mangler (bruk `--force-config` for å overskrive).

## Dev Container (VS Code)

Åpne repoet i VS Code → "Dev Containers: Reopen in Container". Da får du Node 20 + docker-cli i containeren (koblet til host-docker), og dependencies installeres automatisk.

## Produksjon (én container)

Bygger React til statiske filer og lar Node/Express-serveren serve dem (SPA-fallback), slik at du kan kjøre alt i én container bak Traefik.

- Start: `docker compose -f docker-compose.prod.yml up --build`
- App: http://localhost:8080
- Traefik dashboard: http://localhost:8081

Merk:
- Traefik-ruting for denne appen ligger i `traefik/prod/poker-clock.yml` og bruker `PathPrefix('/pokerklokke')`.
- Basepath må matche på 3 steder:
	- Traefik rule: `/pokerklokke`
	- `docker-compose.prod.yml`: `BASE_PATH=/pokerklokke`
	- build-arg til React: `VITE_BASE_PATH=/pokerklokke/`
- `docker-compose.prod.yml` monterer `server/config.json` inn i containeren. I ekte prod bør denne leveres som secret/volume (ikke bake den inn i image).

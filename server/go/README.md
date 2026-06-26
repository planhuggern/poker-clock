# holtebu-server (Go)

REST API-backend som kjører parallelt med Django på port **8082**.
Traefik ruter `https://espen.holtebu.eu/pokerklokke/api/` hit.

## Kjør lokalt

```bash
cd server/go
go run .
# Lytter på :8082, leser ../config.json
```

## Test mot VPS

```bash
# Hent guest-token fra Django
TOKEN=$(curl -s -X POST https://espen.holtebu.eu/pokerklokke/auth/guest/ \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")

# List turneringer
curl -s https://espen.holtebu.eu/pokerklokke/api/tournaments \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Health check (ingen auth)
curl -s http://localhost:8082/health
```

## Test direkte mot lokal server

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/pokerklokke/auth/guest/ \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")

curl -s http://localhost:8082/api/tournaments \
  -H "Authorization: Bearer $TOKEN"
```

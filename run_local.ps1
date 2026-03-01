# PowerShell script for å starte både backend (Django) og frontend (Vite/React) lokalt

# Start backend
Write-Host "Starter backend (Django)..."
Push-Location server
if (-not (Test-Path .venv)) {
    Write-Host "Oppretter Python venv..."
    python -m venv .venv
}
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
Start-Process powershell -ArgumentList '-NoExit', '-Command', '.venv\Scripts\Activate.ps1; python manage.py runserver'
Pop-Location

# Start frontend
Write-Host "Sjekker om port 8081 er i bruk og forsøker å stoppe eventuell prosess..."
if (Test-Path "./stop_port.ps1") {
    powershell -ExecutionPolicy Bypass -File ./stop_port.ps1 -Port 8081
}

Write-Host "Starter frontend (Vite/React)..."
Push-Location client-react
if (-not (Test-Path node_modules)) {
    Write-Host "Installerer npm-avhengigheter..."
    npm install
}
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'npm run dev'
Pop-Location

Write-Host "Både backend og frontend er startet i egne terminaler."

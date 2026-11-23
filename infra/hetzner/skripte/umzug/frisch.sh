#!/usr/bin/env bash
# Umzug · Zurück auf Anfang — NUR vor dem Umschalten erlaubt.
# Setzt die eigene Datenbank und die Dateiablage auf frisch zurück, damit ein
# Umzug sauber wiederholt werden kann. Sobald /etc/pawn/live existiert
# (gesetzt beim Umschalten), verweigert das Skript jede Arbeit.
set -euo pipefail
if [ -f /etc/pawn/live ]; then echo "PAWN ist auf diesem Server live — Zurücksetzen ist gesperrt."; exit 1; fi
cd /opt/pawn/stack
pawn-compose down
rm -rf volumes/db/data
find volumes/storage -mindepth 1 -maxdepth 1 ! -name .gitkeep -exec rm -rf {} +
pawn-compose up -d
for i in $(seq 1 60); do
  docker exec supabase-db pg_isready -U postgres -h localhost >/dev/null 2>&1 && break
  sleep 2
done
echo "frisch: Datenbank und Ablage zurückgesetzt"

#!/usr/bin/env bash
# PAWN · Takt — schaut alle 2 Minuten, ob im Repo ein neuer Stand liegt,
# und stellt ihn dann bereit. So kommt jede Änderung ohne Terminal auf den Server.
set -euo pipefail
R=/opt/pawn/repo
ZWEIG="$(cat /etc/pawn/zweig 2>/dev/null || echo main)"
git -C $R fetch -q --depth 50 origin "$ZWEIG"
ALT=$(git -C $R rev-parse HEAD)
NEU=$(git -C $R rev-parse "origin/$ZWEIG")
[ "$ALT" = "$NEU" ] && exit 0
git -C $R reset -q --hard "origin/$ZWEIG"
echo "takt: $ALT → $NEU"
# Das Steuerpult liest seinen Code aus dem Repo — bei Änderung neu starten.
if ! git -C $R diff --quiet "$ALT" "$NEU" -- infra/hetzner/steuer/ 2>/dev/null; then systemctl restart pawn-steuer.service; fi
cp $R/infra/hetzner/stack/docker-compose.pawn.yml /opt/pawn/stack/docker-compose.pawn.yml
bash $R/infra/hetzner/skripte/bereitstellen.sh

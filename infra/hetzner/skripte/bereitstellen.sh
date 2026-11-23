#!/usr/bin/env bash
# PAWN · Bereitstellen — bringt den Stand aus dem Repo auf den Server.
#
#   1. KI-Funktionen (supabase/functions) → Edge Runtime
#   2. Adressen (vercel.json) → Caddy
#   3. Frontend bauen, nur wenn sich daran etwas geändert hat
#   4. Backend-Container auf den neuen Stand bringen
#
# Läuft beim Einrichten, über den Takt (alle 2 Minuten, nur bei neuem Commit)
# und auf Zuruf über das Steuerpult. Darf beliebig oft laufen.
set -euo pipefail

P=/opt/pawn; G=/etc/pawn; STACK=$P/stack; R=$P/repo; H=$R/infra/hetzner
FN=$STACK/volumes/functions
SHA=$(git -C $R rev-parse --short HEAD)
exec 9>/run/pawn-bereitstellen.lock
flock -n 9 || { echo "bereitstellen läuft schon"; exit 0; }
echo "── bereitstellen $SHA $(date -Is)"

setze_env() { # NAME WERT in die Stack-.env
  if grep -q "^$1=" $STACK/.env; then sed -i "s|^$1=.*|$1=$2|" $STACK/.env; else echo "$1=$2" >> $STACK/.env; fi
}

# ── 1. Funktionen ─────────────────────────────────────────────────────────
vorher=$(find $FN -type f -not -path "*/main/*" -print0 2>/dev/null | sort -z | xargs -0 sha256sum 2>/dev/null | sha256sum | cut -c1-16)
find $FN -mindepth 1 -maxdepth 1 ! -name main ! -name deno.jsonc -exec rm -rf {} +
cp -a $R/supabase/functions/. $FN/
node $H/funktionen/main-anpassen.mjs $FN/main/index.ts
nachher=$(find $FN -type f -not -path "*/main/*" -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-16)
OHNE=$(awk '/^\[functions\./{n=$0; gsub(/^\[functions\.|\]$/,"",n)} /verify_jwt *= *false/{print n}' $R/supabase/config.toml | paste -sd, -)
setze_env FUNCTIONS_NO_VERIFY "$OHNE"
echo "funktionen: $(ls -d $FN/*/ | wc -l) Ordner · ohne Anmeldung: $OHNE"

# ── 2. Caddy ──────────────────────────────────────────────────────────────
cp $H/caddy/Caddyfile $P/caddy/Caddyfile
node $H/caddy/routen-aus-vercel.mjs $R/vercel.json $P/caddy/pawn/routen.caddy

# ── 3. Frontend ───────────────────────────────────────────────────────────
BAU=$(cd $R && git ls-files -s src public index.html package.json package-lock.json vite.config.ts tailwind.config.ts postcss.config.js tsconfig.json tsconfig.app.json tsconfig.node.json components.json | sha256sum | cut -c1-16)
API_URL=$(jq -r .api_url $G/oeffentlich.json)
ANON=$(jq -r .anon_key $G/oeffentlich.json)
BAU="$BAU-$(printf %s "$API_URL$ANON" | sha256sum | cut -c1-8)"
if [ ! -f $P/web/releases/$BAU/index.html ]; then
  echo "frontend: baue $BAU"
  rm -rf $R/dist
  if [ "${PAWN_TEST:-0}" = 1 ]; then
    # Probelauf im Container: Container haben dort kein Netz, also direkt bauen.
    (cd $R && VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" VITE_SUPABASE_PROJECT_ID=pawn npm run build 2>&1 | tail -5)
  else
    docker run --rm -v $R:/app -w /app \
      -e VITE_SUPABASE_URL="$API_URL" -e VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" -e VITE_SUPABASE_PROJECT_ID=pawn \
      -e NODE_OPTIONS=--max-old-space-size=3072 -e npm_config_update_notifier=false \
      node:22-bookworm-slim bash -c "npm ci --no-audit --no-fund --loglevel=error && npm run build" 2>&1 | tail -15
  fi
  test -f $R/dist/index.html
  rm -rf $P/web/releases/$BAU.neu && cp -a $R/dist $P/web/releases/$BAU.neu && mv $P/web/releases/$BAU.neu $P/web/releases/$BAU
else
  echo "frontend: $BAU ist schon gebaut"
fi
ln -sfn releases/$BAU $P/web/aktuell.neu && mv -T $P/web/aktuell.neu $P/web/aktuell
ls -1dt $P/web/releases/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf

# ── 4. Container ──────────────────────────────────────────────────────────
pawn-compose up -d --remove-orphans
if [ "$vorher" != "$nachher" ]; then pawn-compose restart functions; fi
docker exec pawn-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | grep -v '^$' | tail -3 || true

echo "$SHA $(date -Is) frontend=$BAU" > $P/stand/bereitgestellt
echo "── fertig $SHA"

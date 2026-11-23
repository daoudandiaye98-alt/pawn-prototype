#!/usr/bin/env bash
# PAWN · Erstausstattung des eigenen Servers (Ubuntu 24.04).
#
# Läuft beim ersten Start über cloud-init und darf jederzeit erneut laufen:
# Jeder Schritt prüft, ob er schon erledigt ist. Geheimnisse werden NIE neu
# erzeugt, wenn es sie schon gibt — sonst wären alle Anmeldungen ungültig.
#
# Reihenfolge mit Absicht: zuerst das Steuerpult (damit man den Rest aus der
# Ferne sehen und reparieren kann), dann Docker, dann das Backend, zuletzt
# Frontend und Takt.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/daoudandiaye98-alt/pawn-prototype}"
ZWEIG="$(cat /etc/pawn/zweig 2>/dev/null || echo main)"
DOMAIN="$(cat /etc/pawn/domain 2>/dev/null || echo pawn.vision)"
SUPABASE_REF="self-hosted/v0.8.5"   # offizielles Self-Hosting-Release, festgenagelt
P=/opt/pawn
G=/etc/pawn
STACK=$P/stack
LOG=/var/log/pawn-einrichten.log
TEST="${PAWN_TEST:-0}"   # 1 = Probelauf im Container: kein apt, kein systemd, kein Swap

exec > >(tee -a "$LOG") 2>&1
schritt() { echo; echo "── $(date -Is) · $*"; }

schritt "Ordner"
install -d -m 755 $P $P/web/releases $P/caddy/pawn $P/stand $P/umzug /var/lib/pawn/sicherung
install -d -m 700 $G $G/zugang

schritt "Grundpakete"
export DEBIAN_FRONTEND=noninteractive
if [ "$TEST" != 1 ] && { ! command -v node >/dev/null || ! command -v jq >/dev/null || ! command -v psql >/dev/null; }; then
  apt-get update -q
  apt-get install -y -q curl git jq openssl ca-certificates nodejs rsync unattended-upgrades postgresql-client
fi

schritt "Repo ($ZWEIG)"
if [ "$TEST" = 1 ]; then
  echo "Probelauf: Repo bleibt, wie es ist"
elif [ ! -d $P/repo/.git ]; then
  git clone --depth 50 --branch "$ZWEIG" "$REPO_URL" $P/repo
else
  git -C $P/repo fetch --depth 50 origin "$ZWEIG" && git -C $P/repo reset --hard "origin/$ZWEIG"
fi
H=$P/repo/infra/hetzner

schritt "Steuerpult"
if [ "$TEST" != 1 ]; then
  install -m 644 $H/systemd/pawn-steuer.service /etc/systemd/system/pawn-steuer.service
  systemctl daemon-reload
  systemctl enable --now pawn-steuer.service
  systemctl restart pawn-steuer.service
fi

schritt "Auslagerungsspeicher (für den Frontend-Bau)"
if [ "$TEST" != 1 ] && [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

schritt "Docker"
if [ "$TEST" != 1 ]; then
  if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sh
  fi
  mkdir -p /etc/docker
  if [ ! -f /etc/docker/daemon.json ]; then
    # mirror.gcr.io zuerst: Docker Hub drosselt anonyme Abrufe (429) — gemessen am 23.11.2026.
    echo '{"registry-mirrors":["https://mirror.gcr.io"],"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' > /etc/docker/daemon.json
    systemctl restart docker
  fi
  systemctl enable --now docker
fi

# holen <bild> — Docker Hub, sonst Spiegel (ghcr.io, public.ecr.aws, mirror.gcr.io); unter dem Originalnamen ablegen.
holen() {
  local o="$1"
  docker image inspect "$o" >/dev/null 2>&1 && return 0
  for q in "$o" "ghcr.io/$o" "public.ecr.aws/$o" "mirror.gcr.io/$o" "public.ecr.aws/docker/library/$o"; do
    if timeout 900 docker pull -q "$q" >/dev/null 2>&1; then
      [ "$q" != "$o" ] && docker tag "$q" "$o"
      echo "bild: $o (über ${q%%/*})"; return 0
    fi
  done
  echo "BILD FEHLT: $o"; return 1
}

schritt "Supabase (offizielles Release $SUPABASE_REF)"
if [ ! -f $STACK/docker-compose.yml ]; then
  rm -rf /tmp/supabase-src
  git clone --depth 1 --filter=blob:none --sparse --branch "$SUPABASE_REF" https://github.com/supabase/supabase /tmp/supabase-src
  git -C /tmp/supabase-src sparse-checkout set docker
  mkdir -p $STACK && cp -a /tmp/supabase-src/docker/. $STACK/
  echo "$SUPABASE_REF" > $STACK/.pawn-supabase-version
fi
cp $H/stack/docker-compose.pawn.yml $STACK/docker-compose.pawn.yml
cat > $STACK/pawn-compose <<'EOF'
#!/usr/bin/env bash
cd /opt/pawn/stack && exec docker compose -f docker-compose.yml -f docker-compose.pawn.yml --env-file .env "$@"
EOF
chmod 755 $STACK/pawn-compose
ln -sf $STACK/pawn-compose /usr/local/bin/pawn-compose

schritt "Geheimnisse (nur beim ersten Mal)"
if [ ! -f $STACK/.env ] || grep -q '^POSTGRES_PASSWORD=your-super-secret' $STACK/.env; then
  cp $STACK/.env.example $STACK/.env
  (cd $STACK && sh utils/generate-keys.sh --update-env >/dev/null)
  rm -f $STACK/.env.old
  setze() { # setze NAME WERT — ersetzt oder hängt an
    if grep -q "^$1=" $STACK/.env; then sed -i "s|^$1=.*|$1=$2|" $STACK/.env; else echo "$1=$2" >> $STACK/.env; fi
  }
  setze SUPABASE_PUBLIC_URL "https://api.$DOMAIN"
  setze API_EXTERNAL_URL "https://api.$DOMAIN/auth/v1"
  setze SITE_URL "https://$DOMAIN"
  setze ADDITIONAL_REDIRECT_URLS "https://$DOMAIN/**,https://www.$DOMAIN/**,https://neu.$DOMAIN/**"
  setze STUDIO_DEFAULT_ORGANIZATION "PAWN"
  setze STUDIO_DEFAULT_PROJECT "pawn.vision"
  setze DASHBOARD_USERNAME "pawn"
  setze FUNCTIONS_VERIFY_JWT "true"
  setze ENABLE_PHONE_SIGNUP "false"
  setze ENABLE_PHONE_AUTOCONFIRM "false"
  setze ENABLE_EMAIL_AUTOCONFIRM "false"
  setze SMTP_ADMIN_EMAIL "hallo@post.$DOMAIN"
  setze SMTP_HOST "smtp.resend.com"
  setze SMTP_PORT "465"
  setze SMTP_USER "resend"
  setze SMTP_PASS "fehlt-noch"
  setze SMTP_SENDER_NAME "PAWN"
  setze PGRST_DB_SCHEMAS "public,graphql_public"
  setze OPENAI_API_KEY ""
  setze POOLER_TENANT_ID "pawn"
  setze STORAGE_TENANT_ID "pawn"
  setze GLOBAL_S3_BUCKET "pawn"
  setze REGION "fsn1"
  setze GOOGLE_ENABLED "false"
  chmod 600 $STACK/.env
fi
touch $G/funktionen.env && chmod 600 $G/funktionen.env


schritt "Tresor-Schlüssel (RSA, nur beim ersten Mal)"
if [ ! -f $G/tresor-privat.pem ]; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out $G/tresor-privat.pem
  chmod 600 $G/tresor-privat.pem
fi
openssl pkey -in $G/tresor-privat.pem -pubout -out $G/tresor-oeffentlich.pem 2>/dev/null
chmod 644 $G/tresor-oeffentlich.pem

# Öffentliche Werte (gehen ins Frontend und auf die Lage-Seite) — keine Geheimnisse.
ANON=$(grep '^ANON_KEY=' $STACK/.env | cut -d= -f2-)
jq -n --arg url "https://api.$DOMAIN" --arg anon "$ANON" --arg domain "$DOMAIN" --rawfile pem $G/tresor-oeffentlich.pem \
  '{api_url:$url, anon_key:$anon, domain:$domain, tresor_pem:$pem}' > $G/oeffentlich.json
chmod 644 $G/oeffentlich.json

schritt "Caddy-Einstellungen"
if [ ! -f $G/caddy.env ]; then
  cat > $G/caddy.env <<EOF
ACME_EMAIL=oroborosdesign@gmail.com
PAWN_DOMAIN=$DOMAIN
PAWN_WEB_HOSTS=neu.$DOMAIN
PAWN_WWW_HOST=www.$DOMAIN
PAWN_API_HOST=api.$DOMAIN
PAWN_STUDIO_HOST=studio.$DOMAIN
EOF
fi
DASH_USER=$(grep '^DASHBOARD_USERNAME=' $STACK/.env | cut -d= -f2-)
DASH_PW=$(grep '^DASHBOARD_PASSWORD=' $STACK/.env | cut -d= -f2-)
if [ ! -s $P/caddy/pawn/studio-zugang ]; then
  holen caddy:2.10-alpine
  HASH=$(docker run --rm caddy:2.10-alpine caddy hash-password --plaintext "$DASH_PW")
  echo "$DASH_USER $HASH" > $P/caddy/pawn/studio-zugang
fi

schritt "Caddy-Grundlage (vor dem ersten Start)"
cp $H/caddy/Caddyfile $P/caddy/Caddyfile
node $H/caddy/routen-aus-vercel.mjs $P/repo/vercel.json $P/caddy/pawn/routen.caddy
if [ ! -e $P/web/aktuell ]; then
  mkdir -p $P/web/releases/leer && echo '<!doctype html><meta charset="utf-8"><title>PAWN</title><p>PAWN zieht ein.</p>' > $P/web/releases/leer/index.html
  ln -sfn releases/leer $P/web/aktuell
fi

schritt "Backend starten"
for bild in $(pawn-compose config --images | sort -u) node:22-bookworm-slim; do holen "$bild"; done
pawn-compose up -d

schritt "Bereitstellen (Funktionen, Frontend, Adressen)"
bash $H/skripte/bereitstellen.sh

schritt "Takt und Sicherung"
[ "$TEST" = 1 ] && { echo "Probelauf: kein systemd"; exit 0; }
install -m 644 $H/systemd/pawn-takt.service $H/systemd/pawn-takt.timer $H/systemd/pawn-sicherung.service $H/systemd/pawn-sicherung.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pawn-takt.timer pawn-sicherung.timer

schritt "Fertig"
echo "einrichten fertig $(date -Is)" > $P/stand/eingerichtet

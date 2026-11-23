#!/usr/bin/env bash
# PAWN · Sicherung — jede Nacht die ganze Datenbank und alle Dateien.
# Sieben Tage bleiben liegen. (Zusätzlich empfohlen: Hetzner-Backups für den
# ganzen Server — die liegen nicht auf derselben Platte.)
set -euo pipefail
Z=/var/lib/pawn/sicherung
T=$(date +%F)
mkdir -p $Z
docker exec supabase-db pg_dump -U supabase_admin -d postgres -Fc > $Z/datenbank-$T.dump.neu
mv $Z/datenbank-$T.dump.neu $Z/datenbank-$T.dump
tar -C /opt/pawn/stack/volumes -cf - storage | gzip -1 > $Z/dateien-$T.tar.gz.neu
mv $Z/dateien-$T.tar.gz.neu $Z/dateien-$T.tar.gz
find $Z -type f -mtime +7 -delete
echo "sicherung $T: $(du -sh $Z | cut -f1) gesamt" | tee /opt/pawn/stand/sicherung

// Stillgelegt: Testdaten werden ausschliesslich in isolierten Testumgebungen angelegt.
// Als Tombstone deployen: Loeschen im Git entfernt keine laufende Funktion.
// Keine Datenbankverbindung, Konten oder Passwoerter, auch bei gueltigem JWT.
Deno.serve(() => new Response(JSON.stringify({ error: "endpoint_retired" }), {
  status: 410,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
}));

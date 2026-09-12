// seed-testaccounts ist stillgelegt.
// Die Funktion legt keine Konten mehr an, enthält keine Passwörter
// und baut keine Datenbankverbindung auf. Jede Anfrage: HTTP 410.
Deno.serve(() => {
  return new Response(JSON.stringify({ error: "endpoint_retired" }), {
    status: 410,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
});

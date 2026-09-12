// The verified origin is passed by deployment.mjs, never inferred from a page URL.
export function bypassOrigin(adresse, explicit) {
  const url = new URL(adresse);
  return url.protocol === "https:" && !url.username && !url.password &&
    ((!explicit && url.hostname.endsWith(".vercel.app")) ||
      ["pawn.vision", "www.pawn.vision"].includes(url.hostname)) ? url.origin : "";
}

export async function begrenzeBypass(context, origin, secret) {
  if (!origin || !secret) return;
  if (bypassOrigin(origin, false) !== origin) throw new Error("Untrusted bypass origin");
  await context.route("**/*", async route => {
    const request = route.request();
    const headers = { ...request.headers() };
    for (const name of Object.keys(headers)) {
      if (name.toLowerCase() === "x-vercel-protection-bypass") delete headers[name];
    }
    if (new URL(request.url()).origin !== origin) return route.continue({ headers });
    headers["x-vercel-protection-bypass"] = secret;
    // continue({headers}) carries headers across redirects. Fetch one hop only;
    // the browser then follows any redirect through this origin check again.
    const response = await route.fetch({ headers, maxRedirects: 0 });
    await route.fulfill({ response });
  });
}

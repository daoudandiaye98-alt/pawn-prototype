#!/usr/bin/env node
/**
 * Hetzner-Cloud-Werkzeug für PAWN (läuft beim Agenten, nicht auf dem Server).
 * Token über die Umgebung: HCLOUD_TOKEN (Projekt-Token, Lesen & Schreiben).
 *
 *   node hetzner.mjs angebot [ort]          was ist bestellbar, was kostet es
 *   node hetzner.mjs liste                  Server im Projekt
 *   node hetzner.mjs anlegen <typ> <ort> <zweig> <zugang-id> <zugang.pub> [--backups]
 *   node hetzner.mjs status <server-id>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.hetzner.cloud/v1";
const TOKEN = process.env.HCLOUD_TOKEN;
if (!TOKEN) { console.error("HCLOUD_TOKEN fehlt"); process.exit(2); }
const hier = path.dirname(fileURLToPath(import.meta.url));

async function api(methode, pfad, body) {
  const r = await fetch(API + pfad, {
    method: methode,
    headers: { Authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const daten = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(`${methode} ${pfad} → ${r.status} ${JSON.stringify(daten.error || daten)}`);
  return daten;
}
const euro = (s) => Number(s).toFixed(2).replace(".", ",") + " €";

const [, , aktion, ...a] = process.argv;

if (aktion === "angebot") {
  const ort = a[0] || "fsn1";
  const { server_types } = await api("GET", "/server_types?per_page=50");
  // Seit 2026 steht die Verfügbarkeit am Servertyp selbst (locations[].available);
  // /datacenters ist abgeschaltet (Hetzner-Changelog 2026-06-02).
  const zeilen = server_types
    .filter((t) => !t.deprecation)
    .map((t) => {
      const p = t.prices.find((x) => x.location === ort);
      const da = (t.locations || []).some((l) => l.name === ort && l.available);
      return p && { name: t.name, arch: t.architecture, kerne: t.cores, ram: t.memory, platte: t.disk, netto: Number(p.price_monthly.net), brutto: Number(p.price_monthly.gross), da };
    })
    .filter(Boolean)
    .sort((x, y) => x.netto - y.netto);
  for (const z of zeilen) console.log(`${z.da ? "✓" : "✗"} ${z.name.padEnd(7)} ${z.arch.padEnd(4)} ${String(z.kerne).padStart(2)} Kerne ${String(z.ram).padStart(4)} GB RAM ${String(z.platte).padStart(4)} GB  ${euro(z.netto)} netto / ${euro(z.brutto)} brutto im Monat`);
  const { pricing } = await api("GET", "/pricing");
  const ip = pricing.primary_ips?.find((p) => p.type === "ipv4")?.prices?.find((p) => p.location === ort);
  if (ip) console.log(`IPv4-Adresse: ${euro(ip.price_monthly.net)} netto / ${euro(ip.price_monthly.gross)} brutto im Monat`);
  console.log(`Backups: ${pricing.server_backup?.percentage ?? "?"} % auf den Serverpreis`);
} else if (aktion === "liste") {
  const { servers } = await api("GET", "/servers");
  for (const s of servers) console.log(`${s.id} ${s.name} ${s.status} ${s.server_type.name} ${s.public_net.ipv4?.ip} ${s.public_net.ipv6?.ip}`);
} else if (aktion === "status") {
  const { server } = await api("GET", `/servers/${a[0]}`);
  console.log(JSON.stringify({ id: server.id, name: server.name, status: server.status, typ: server.server_type.name, ipv4: server.public_net.ipv4?.ip, ipv6: server.public_net.ipv6?.ip, backups: server.backup_window }, null, 2));
} else if (aktion === "anlegen") {
  const [typ, ort, zweig, zugangId, zugangDatei] = a;
  const mitBackups = a.includes("--backups");
  if (!typ || !ort || !zweig || !zugangId || !zugangDatei) throw new Error("anlegen <typ> <ort> <zweig> <zugang-id> <zugang.pub> [--backups]");
  // Tor (Firewall): nur Web nach innen. Kein SSH — gesteuert wird über das Steuerpult.
  const name = "pawn-tor";
  let { firewalls } = await api("GET", `/firewalls?name=${name}`);
  let tor = firewalls[0];
  if (!tor) {
    tor = (await api("POST", "/firewalls", {
      name,
      labels: { projekt: "pawn" },
      rules: [
        { direction: "in", protocol: "tcp", port: "80", source_ips: ["0.0.0.0/0", "::/0"], description: "HTTP (Zertifikate, Umleitung)" },
        { direction: "in", protocol: "tcp", port: "443", source_ips: ["0.0.0.0/0", "::/0"], description: "HTTPS" },
        { direction: "in", protocol: "udp", port: "443", source_ips: ["0.0.0.0/0", "::/0"], description: "HTTP/3" },
        { direction: "in", protocol: "icmp", source_ips: ["0.0.0.0/0", "::/0"], description: "Ping" },
      ],
    })).firewall;
  }
  const pub = fs.readFileSync(zugangDatei, "utf8").trimEnd().split("\n").map((z) => "      " + z).join("\n");
  const userData = fs.readFileSync(path.join(hier, "..", "cloud-init.yaml"), "utf8")
    .replaceAll("__ZWEIG__", zweig)
    .replaceAll("__DOMAIN__", process.env.PAWN_DOMAIN || "pawn.vision")
    .replaceAll("__ZUGANG_ID__", zugangId)
    .replace("__ZUGANG_PUB__", pub);
  const { server, action } = await api("POST", "/servers", {
    name: "pawn",
    server_type: typ,
    location: ort,
    image: "ubuntu-24.04",
    user_data: userData,
    firewalls: [{ firewall: tor.id }],
    labels: { projekt: "pawn" },
    public_net: { enable_ipv4: true, enable_ipv6: true },
    start_after_create: true,
  });
  console.log(JSON.stringify({ id: server.id, status: server.status, ipv4: server.public_net.ipv4?.ip, ipv6: server.public_net.ipv6?.ip, aktion: action?.status }, null, 2));
  if (mitBackups) {
    await api("POST", `/servers/${server.id}/actions/enable_backup`);
    console.log("Backups eingeschaltet");
  }
} else {
  console.error("aktion: angebot [ort] | liste | status <id> | anlegen …");
  process.exitCode = 2;
}

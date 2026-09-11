/**
 * Der Zugang — was an genau einer Stelle stehen muss.
 *
 * Teil L5–L10. Es gibt zwei Hüllen, die jemanden anlegen können: die React-Maske
 * in /start und die Zugang-Doppelseite im Heft. Stünde der Vergleich der beiden
 * Passwörter in beiden, würde einer davon irgendwann vergessen — und ein Vertipper
 * fällt erst beim nächsten Anmelden auf, wenn das Konto längst angelegt ist.
 *
 * Deshalb liegt er in `features/auth/registrieren.ts`, und hier steht der Beweis,
 * dass er wirklich VOR `signUp` fällt: der Spion darf nicht angefasst worden sein.
 */
import { describe, it, expect, vi } from "vitest";
import { registrieren } from "@/features/auth/registrieren";
import { sichererPfad, tuerFuerRollen } from "@/features/auth/tueren";

const UNGLEICH = "Die beiden Passwörter sind nicht gleich.";

describe("registrieren — der Vergleich fällt vor signUp", () => {
  it("legt bei zwei verschiedenen Passwörtern KEIN Konto an", async () => {
    const signUp = vi.fn(async () => ({}));
    const ergebnis = await registrieren(
      signUp,
      { email: "mina@example.de", passwort: "einslang123", wiederholung: "einslang124" },
      UNGLEICH,
    );
    expect(ergebnis.fehler).toBe(UNGLEICH);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("legt bei gleichen Passwörtern an — mit getrimmter Adresse und einem Namen", async () => {
    const signUp = vi.fn(async () => ({}));
    const ergebnis = await registrieren(
      signUp,
      { email: "  mina@example.de  ", passwort: "einslang123", wiederholung: "einslang123" },
      UNGLEICH,
    );
    expect(ergebnis.fehler).toBeUndefined();
    expect(signUp).toHaveBeenCalledWith("mina@example.de", "einslang123", "mina");
  });

  it("nimmt den eingetippten Namen, wenn es einen gibt", async () => {
    const signUp = vi.fn(async () => ({}));
    await registrieren(
      signUp,
      { email: "d@example.de", passwort: "abcabc12", wiederholung: "abcabc12", name: "  Mina  " },
      UNGLEICH,
    );
    expect(signUp).toHaveBeenCalledWith("d@example.de", "abcabc12", "Mina");
  });

  it("reicht den Fehler von signUp durch, statt ihn zu verschlucken", async () => {
    const signUp = vi.fn(async () => ({ error: "User already registered" }));
    const ergebnis = await registrieren(
      signUp,
      { email: "d@example.de", passwort: "abcabc12", wiederholung: "abcabc12" },
      UNGLEICH,
    );
    expect(ergebnis.fehler).toBe("User already registered");
  });
});

describe("tuerFuerRollen — drei Publikumstüren, eine Antwort", () => {
  it("führt Admin ins Cockpit, auch wenn er zusätzlich ein Haus ist", () => {
    expect(tuerFuerRollen(["admin"])).toBe("/admin");
    expect(tuerFuerRollen(["designer", "admin"])).toBe("/admin");
  });
  it("führt ein Haus ins Studio", () => {
    expect(tuerFuerRollen(["designer"])).toBe("/studio");
  });
  it("führt alle anderen ins Heft", () => {
    expect(tuerFuerRollen([])).toBe("/konto");
    expect(tuerFuerRollen(null)).toBe("/konto");
    expect(tuerFuerRollen(["kunde"])).toBe("/konto");
  });
});

describe("sichererPfad — ein Rückkehrziel, dem man trauen kann", () => {
  it("lässt eigene, relative Pfade durch", () => {
    expect(sichererPfad("/tasche")).toBe("/tasche");
    expect(sichererPfad("/haus/drape/2?x=1")).toBe("/haus/drape/2?x=1");
  });

  /* Der eigentliche Grund für diese Funktion: `//fremder.host` ist ein gültiger
     Verweis auf einen ANDEREN Server, der das Schema der Seite erbt. Landete er in
     Googles redirectTo, wäre das ein offenes Redirect mit PAWNs Namen davor. */
  it("weist fremde Ziele ab", () => {
    expect(sichererPfad("//fremder.example/x")).toBeNull();
    expect(sichererPfad("https://fremder.example")).toBeNull();
    expect(sichererPfad("/\\fremder.example")).toBeNull();
    expect(sichererPfad("javascript:alert(1)")).toBeNull();
  });

  it("weist /auth ab — sonst leitete die Seite auf sich selbst zurück", () => {
    expect(sichererPfad("/auth")).toBeNull();
    expect(sichererPfad("/auth/")).toBeNull();
    expect(sichererPfad("/auth?next=/tasche")).toBeNull();
  });

  it("weist Steuerzeichen und Nicht-Zeichenketten ab", () => {
    expect(sichererPfad("/tasche\nSet-Cookie: x")).toBeNull();
    expect(sichererPfad(null)).toBeNull();
    expect(sichererPfad(undefined)).toBeNull();
    expect(sichererPfad("")).toBeNull();
  });
});

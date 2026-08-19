/**
 * Teil B1 — der Wort-Spalter, an seinen drei Versprechen gemessen.
 */
import { describe, expect, it } from "vitest";
import { zerlege } from "@/styles/zerlege";

function absatz(html: string): HTMLElement {
  const p = document.createElement("p");
  p.innerHTML = html;
  document.body.appendChild(p);
  return p;
}

describe("Teil B1 — zerlege", () => {
  it("wickelt jedes Wort, und die Leerzeichen bleiben draußen", () => {
    const p = absatz("Kunst von Händen");
    const { teile } = zerlege(p);
    expect(teile).toHaveLength(3);
    expect(teile.map((t) => t.textContent)).toEqual(["Kunst", "von", "Händen"]);
    /* Der Umbruch hängt daran: ein Leerzeichen IM inline-block bricht nicht. */
    for (const t of teile) expect(t.textContent).not.toMatch(/\s/);
    const zwischen = [...p.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE);
    expect(zwischen.length, "Leerzeichen fehlen zwischen den Hüllen").toBe(2);
  });

  it("gibt dem Ohr den ganzen Satz und versteckt die Teile", () => {
    const p = absatz("Was hier hängt, hat jemand gemacht.");
    const { teile } = zerlege(p);
    expect(p.getAttribute("aria-label")).toBe("Was hier hängt, hat jemand gemacht.");
    for (const t of teile) expect(t.getAttribute("aria-hidden")).toBe("true");
  });

  it("lässt ausgezeichneten Text ganz, statt ihn zu zerreißen", () => {
    const p = absatz('Mehr im <a href="/datenschutz">Datenschutz</a>.');
    const { teile } = zerlege(p);
    expect(teile).toEqual([p]);
    expect(p.querySelector("a"), "der Link darf nicht verschwinden").not.toBeNull();
  });

  it("zerlegt zeichenweise, wenn eine Cover-Zeile es verlangt", () => {
    const p = absatz("PAWN");
    const { teile } = zerlege(p, "zeichen");
    expect(teile.map((t) => t.textContent)).toEqual(["P", "A", "W", "N"]);
  });

  it("tut nichts doppelt und lässt sich zurücknehmen", () => {
    const p = absatz("Zwei Wörter");
    const erste = zerlege(p);
    const zweite = zerlege(p);
    expect(zweite.teile).toHaveLength(erste.teile.length);
    erste.zurueck();
    expect(p.innerHTML).toBe("Zwei Wörter");
    expect(p.hasAttribute("aria-label")).toBe(false);
  });
});

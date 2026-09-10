#!/usr/bin/env python3
"""Freistellung der vorbereiteten Green-Key-Motive — einmal beim Build, nie im Browser.

Eingabe : quellbilder/cutout-<id>-key.png   (Motiv auf grünem Farbhintergrund)
Ausgabe : assets/cutout-<id>.webp           (transparent, beschnitten, skaliert)
          assets/cutouts.json               (Seitenverhältnis + Pixelmaße je Motiv)

Dieselbe Schwelle wie die frühere Browser-Fassung, damit sich die Silhouetten
nicht verändern. NICHT auf echte Produktfotos anwenden — grüne Kleidung würde
zerstört. Für reale Ware gehört eine Segmentierung in die Medienpipeline.
"""
import json, pathlib, sys
import numpy as np
from PIL import Image

MAX_HEIGHT = 1200
QUALITY = 82
SCHWELLE, WEICHE, RAND = 8, 55, 2

quelle = pathlib.Path("quellbilder")
ziel = pathlib.Path("assets")
ziel.mkdir(exist_ok=True)

manifest = {}
for datei in sorted(quelle.glob("cutout-*-key.png")):
    name = datei.stem.replace("cutout-", "").replace("-key", "")
    rgb = np.asarray(Image.open(datei).convert("RGB")).astype(np.int16)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    ueberschuss = g - np.maximum(r, b)
    alpha = 1.0 - np.clip((ueberschuss - SCHWELLE) / WEICHE, 0.0, 1.0)

    # Kante um ein Pixel zurücknehmen, damit keine Restpixel des Hintergrunds stehenbleiben.
    a = alpha
    geschrumpft = np.minimum.reduce([
        np.pad(a, ((1, 0), (0, 0)), constant_values=1)[:-1], np.pad(a, ((0, 1), (0, 0)), constant_values=1)[1:],
        np.pad(a, ((0, 0), (1, 0)), constant_values=1)[:, :-1], np.pad(a, ((0, 0), (0, 1)), constant_values=1)[:, 1:], a])
    alpha = np.where(geschrumpft < 0.5, np.minimum(alpha, geschrumpft), alpha)
    alpha = np.where(alpha < 0.12, 0.0, alpha)

    # Grünstich zurücknehmen: mild im Motiv, entschieden im Randsaum.
    g = np.where(ueberschuss > 4, np.minimum(g, np.maximum(r, b) + 4), g)
    saum = alpha < 0.995
    g = np.where(saum, np.minimum(g, (r + b) // 2), g)

    sichtbar = alpha > 0.04
    if not sichtbar.any():
        sys.exit(f"Kein sichtbarer Bereich in {datei}")
    ys, xs = np.where(sichtbar)
    oben, unten, links, rechts = ys.min(), ys.max(), xs.min(), xs.max()

    rgba = np.dstack([r, g, b, np.round(alpha * 255)]).astype(np.uint8)
    bild = Image.fromarray(rgba, "RGBA").crop((links, oben, rechts + 1, unten + 1))
    rahmen = Image.new("RGBA", (bild.width + RAND * 2, bild.height + RAND * 2), (0, 0, 0, 0))
    rahmen.paste(bild, (RAND, RAND))
    bild = rahmen

    if bild.height > MAX_HEIGHT:
        breite = round(bild.width * MAX_HEIGHT / bild.height)
        bild = bild.resize((breite, MAX_HEIGHT), Image.LANCZOS)

    aus = ziel / f"cutout-{name}.webp"
    bild.save(aus, "WEBP", quality=QUALITY, method=6, exact=False)
    manifest[name] = {"w": bild.width, "h": bild.height, "ratio": round(bild.width / bild.height, 6)}
    print(f"{name:8s} {bild.width}x{bild.height}  {aus.stat().st_size/1024:6.0f} kB   (aus {datei.stat().st_size/1024:.0f} kB)")

(ziel / "cutouts.json").write_text(json.dumps(manifest, indent=1, sort_keys=True) + "\n")
print("\nassets/cutouts.json geschrieben:", ", ".join(sorted(manifest)))

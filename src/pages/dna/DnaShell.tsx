import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { useAuth } from "@/lib/auth";

/** Gemeinsamer Rahmen der drei DNA-Flächen: Avatar, Räume, Anproben. */
export function DnaShell({
  eyebrow, titel, satz, children, title, description,
}: {
  eyebrow: string;
  titel: string;
  satz: string;
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const { user, loading } = useAuth();

  return (
    <PalaceLayout title={title} description={description} transparentHeader={false} showBreadcrumbs>
      <section className="mx-auto max-w-[1100px] px-6 pb-24 pt-28 md:px-14 md:pt-36">
        <p className="text-[0.6rem] uppercase tracking-[0.3em] text-black">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl leading-[0.95] text-black md:text-6xl">{titel}</h1>
        <p className="mt-4 max-w-[62ch] font-sans text-[0.95rem] leading-relaxed text-black">{satz}</p>

        <div className="mt-10">
          {loading ? null : user ? children : (
            <div className="border-[1.5px] border-black p-8">
              <p className="font-sans text-[0.95rem] text-black">
                Deine Bilder gehören dir allein — dafür brauchst du ein Konto.
              </p>
              <Link
                to="/konto"
                className="mt-5 inline-block border-[1.5px] border-black px-6 py-3 text-[0.68rem] uppercase tracking-[0.24em] text-black transition-colors hover:bg-black hover:text-white"
              >
                Anmelden
              </Link>
            </div>
          )}
        </div>
      </section>
    </PalaceLayout>
  );
}

/** Die Einwilligungskarte — sie steht vor allem anderen. */
export function EinwilligungKarte({ onJa, laufend }: { onJa: () => void; laufend: boolean }) {
  return (
    <div className="border-[1.5px] border-black p-8">
      <p className="font-serif text-2xl text-black">Dein Bild, deine Entscheidung.</p>
      <p className="mt-4 max-w-[62ch] font-sans text-[0.95rem] leading-relaxed text-black">
        Für eine Anprobe geht dein Foto an einen Dienstleister (fal.ai), der daraus ein
        Anprobebild rechnet. Es liegt danach in deinem privaten Speicher — sonst sieht es
        niemand. Du kannst jedes Bild einzeln löschen, jederzeit.
      </p>
      <button
        type="button"
        disabled={laufend}
        onClick={onJa}
        className="mt-6 border-[1.5px] border-black px-6 py-3 text-[0.68rem] uppercase tracking-[0.24em] text-black transition-colors hover:bg-black hover:text-white disabled:opacity-40"
      >
        Einverstanden
      </button>
    </div>
  );
}

export function Knopf({
  children, onClick, disabled, invers,
}: { children: ReactNode; onClick?: () => void; disabled?: boolean; invers?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`border-[1.5px] border-black px-4 py-2 text-[0.62rem] uppercase tracking-[0.22em] transition-colors disabled:opacity-40 ${
        invers ? "bg-black text-white hover:bg-white hover:text-black" : "bg-white text-black hover:bg-black hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

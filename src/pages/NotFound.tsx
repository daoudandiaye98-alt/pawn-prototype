import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";

const NotFound = () => {
  const location = useLocation();
  useEffect(() => {
    console.error("404: Route nicht gefunden:", location.pathname);
  }, [location.pathname]);

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto flex min-h-[70vh] max-w-[900px] flex-col items-center justify-center px-6 py-32 text-center">
        <p className="palace-eyebrow">404</p>
        <h1
          className="palace-serif mt-6 font-light text-[#0C0C0E]"
          style={{ fontSize: "clamp(2.6rem, 6vw, 5rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
        >
          Dieser Raum <span className="italic">existiert nicht.</span>
        </h1>
        <p className="mt-8 max-w-md font-serif italic text-[1.05rem] text-[#0C0C0E]/70">
          Vielleicht wurde er verschoben, umbenannt, oder du bist einer alten Adresse gefolgt.
        </p>
        <Link
          to="/"
          className="mt-12 inline-flex border border-[#0C0C0E] px-8 py-3 text-[0.65rem] uppercase tracking-[0.42em] text-[#0C0C0E] transition-colors hover:bg-[#0C0C0E] hover:text-[#F1EEE7]"
        >
          Zurück zur Ausstellung
        </Link>
      </section>
    </PalaceLayout>
  );
};

export default NotFound;

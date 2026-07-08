import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

function homeForRoles(roles: string[]) {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("designer")) return "/studio";
  return "/account";
}

export default function Auth() {
  const { user, roles, loading, signInWithPassword, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to={homeForRoles(roles)} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } =
      mode === "in"
        ? await signInWithPassword(email, password)
        : await signUp(email, password, displayName || email.split("@")[0]);
    setBusy(false);
    if (error) return toast.error(error);
    if (mode === "up") toast.success("Prüfe deine E-Mail zur Bestätigung.");
    // Role redirect happens automatically via the Navigate above once auth state updates.
    else navigate("/account");
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    setBusy(false);
    if (error) toast.error(error);
  };

  return (
    <PalaceLayout transparentHeader={false}>
      {/* Subtle chessboard backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #000000 25%, transparent 25%), linear-gradient(-45deg, #000000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000000 75%), linear-gradient(-45deg, transparent 75%, #000000 75%)",
          backgroundSize: "48px 48px",
          backgroundPosition: "0 0, 0 24px, 24px -24px, -24px 0",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <section className="relative z-10 mx-auto flex min-h-[80vh] w-full max-w-[520px] flex-col justify-center px-6 pt-32 pb-20 md:pt-40">

        <p className="palace-eyebrow text-center">Zutritt</p>
        <h1
          className="palace-serif mt-6 text-center font-light text-[#000000]"
          style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
        >
          {mode === "in" ? <>Willkommen <span className="italic">zurück.</span></> : <>Trage dich <span className="italic">ein.</span></>}
        </h1>
        <p className="mt-6 text-center font-serif italic text-[#000000]/70">
          Deine Ausstellung, wie du sie verlassen hast.
        </p>

        <div className="mt-12 flex justify-center gap-8">
          {(["in", "up"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`palace-eyebrow pb-2 transition-colors duration-300 ${
                mode === k ? "border-b border-[#000000] text-[#000000]" : "text-[#7C7972] hover:text-[#000000]"
              }`}
            >
              {k === "in" ? "Anmelden" : "Konto anlegen"}
            </button>
          ))}
        </div>

        {mode === "up" && (
          <div className="mt-10 border border-[rgba(0,0,0,.18)] bg-white/40 p-5 text-center">
            <p className="palace-eyebrow">Registrieren als</p>
            <div className="mt-3 flex items-center justify-center gap-6 text-[0.75rem] uppercase tracking-[0.28em]">
              <span className="border-b border-[#000000] pb-1 text-[#000000]">Kunde</span>
              <Link to="/apply" className="text-[#7C7972] hover:text-[#000000]">Designer →</Link>
            </div>
            <p className="mt-3 text-[0.7rem] text-[#7C7972]">Designer bewerben sich über /apply — dort erfährst du unser Angebot.</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          {mode === "up" && (
            <Field label="Name" value={displayName} onChange={setDisplayName} />
          )}
          <Field label="E-Mail" value={email} onChange={setEmail} type="email" required />
          <Field label="Passwort" value={password} onChange={setPassword} type="password" required />
          <button
            type="submit"
            disabled={busy}
            className="palace-btn w-full justify-center text-center hover:bg-[#000000] hover:text-[#FFFFFF] disabled:opacity-50"
          >
            {busy ? "…" : mode === "in" ? "Anmelden" : "Konto anlegen"}
          </button>
        </form>

        <div className="my-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-[rgba(0,0,0,.18)]" />
          <span className="palace-eyebrow">oder</span>
          <div className="h-px flex-1 bg-[rgba(0,0,0,.18)]" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="palace-btn w-full justify-center text-center disabled:opacity-50"
        >
          Mit Google fortfahren
        </button>

        <p className="mt-10 text-center palace-eyebrow">
          <Link to="/" className="uline text-[#000000]">Zurück zur Ausstellung</Link>
        </p>
      </section>
    </PalaceLayout>
  );
}

function Field({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="palace-eyebrow">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-3 w-full border-0 border-b border-[rgba(0,0,0,.28)] bg-transparent py-3 text-[1rem] text-[#000000] focus:border-[#000000] focus:outline-none focus:ring-0"
      />
    </label>
  );
}

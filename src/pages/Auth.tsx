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
      <section className="mx-auto flex min-h-[80vh] w-full max-w-[520px] flex-col justify-center px-6 pt-32 pb-20 md:pt-40">
        <p className="palace-eyebrow text-center">Zutritt</p>
        <h1
          className="palace-serif mt-6 text-center font-light text-[#0C0C0E]"
          style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
        >
          {mode === "in" ? <>Willkommen <span className="italic">zurück.</span></> : <>Trage dich <span className="italic">ein.</span></>}
        </h1>
        <p className="mt-6 text-center font-serif italic text-[#0C0C0E]/70">
          Deine Ausstellung, wie du sie verlassen hast.
        </p>

        <div className="mt-12 flex justify-center gap-8">
          {(["in", "up"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`palace-eyebrow pb-2 transition-colors duration-300 ${
                mode === k ? "border-b border-[#0C0C0E] text-[#0C0C0E]" : "text-[#7C7972] hover:text-[#0C0C0E]"
              }`}
            >
              {k === "in" ? "Anmelden" : "Konto anlegen"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-12 space-y-8">
          {mode === "up" && (
            <Field label="Name" value={displayName} onChange={setDisplayName} />
          )}
          <Field label="E-Mail" value={email} onChange={setEmail} type="email" required />
          <Field label="Passwort" value={password} onChange={setPassword} type="password" required />
          <button
            type="submit"
            disabled={busy}
            className="palace-btn w-full justify-center text-center hover:bg-[#0C0C0E] hover:text-[#F1EEE7] disabled:opacity-50"
          >
            {busy ? "…" : mode === "in" ? "Anmelden" : "Konto anlegen"}
          </button>
        </form>

        <div className="my-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-[rgba(12,12,14,.13)]" />
          <span className="palace-eyebrow">oder</span>
          <div className="h-px flex-1 bg-[rgba(12,12,14,.13)]" />
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
          <Link to="/" className="uline text-[#0C0C0E]">Zurück zur Ausstellung</Link>
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
        className="mt-3 w-full border-0 border-b border-[rgba(12,12,14,.28)] bg-transparent py-3 text-[1rem] text-[#0C0C0E] focus:border-[#0C0C0E] focus:outline-none focus:ring-0"
      />
    </label>
  );
}

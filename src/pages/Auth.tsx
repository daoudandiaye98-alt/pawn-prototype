import { Navigate, useSearchParams, Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuthForm } from "@/features/auth/useAuthForm";

function homeForRoles(roles: string[]) {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("designer")) return "/studio";
  return "/account";
}

// Return-to-Flow: /start (First Move) schickt hierher, wenn jemand mit bestehendem Zugang auf
// "Ich hab schon einen Zugang" tippt — nach dem Login geht's exakt dahin zurück, nicht in die
// rollenbasierte Standard-Startseite. Nur relative, interne Pfade — kein offenes Redirect-Ziel.
function safeReturnTo(v: string | null): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v === "/auth") return null;
  return v;
}

export default function Auth() {
  const { user, roles, loading } = useAuth();
  const { t } = useI18n();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const auth = useAuthForm({ checkEmailMessage: t("auth.checkEmail") });

  if (loading) return null;
  if (user) return <Navigate to={returnTo ?? homeForRoles(roles)} replace />;

  const { mode, setMode, email, setEmail, password, setPassword, displayName, setDisplayName, busy, submit, submitGoogle } = auth;

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

        <p className="palace-eyebrow text-center">{t("auth.entry")}</p>
        <h1
          className="palace-serif mt-6 text-center font-light text-[#000000]"
          style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
        >
          {mode === "in" ? t("auth.welcomeBack") : t("auth.joinTitle")}
        </h1>
        <p className="mt-6 text-center font-serif italic text-[#000000]/70">
          {t("auth.welcomeBackSub")}
        </p>

        <div className="mt-12 flex justify-center gap-8">
          {(["in", "up"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`palace-eyebrow pb-2 transition-colors duration-300 ${
                mode === k ? "border-b border-[#000000] text-[#000000]" : "text-black/60 hover:text-[#000000]"
              }`}
            >
              {k === "in" ? t("auth.signIn") : t("auth.signUp")}
            </button>
          ))}
        </div>

        {mode === "up" && (
          <div className="mt-10 border border-[rgba(0,0,0,.18)] bg-white/40 p-5 text-center">
            <p className="palace-eyebrow">{t("auth.registerAs")}</p>
            <div className="mt-3 flex items-center justify-center gap-6 text-[0.75rem] uppercase tracking-[0.28em]">
              <span className="border-b border-[#000000] pb-1 text-[#000000]">{t("auth.asCustomer")}</span>
              <Link to="/apply" className="text-black/60 hover:text-[#000000]">{t("auth.asDesigner")} →</Link>
            </div>
            <p className="mt-3 text-[0.7rem] text-black/60">{t("auth.designerHint")}</p>
          </div>
        )}
        <form onSubmit={submit} className="mt-8 space-y-8">
          {mode === "up" && (
            <Field label={t("auth.name")} value={displayName} onChange={setDisplayName} />
          )}
          <Field label={t("auth.email")} value={email} onChange={setEmail} type="email" required />
          <Field label={t("auth.password")} value={password} onChange={setPassword} type="password" required />
          <Button
            type="submit"
            variant="editorial"
            size="chip"
            loading={busy}
            className="w-full justify-center text-center hover:bg-black hover:text-white"
          >
            {mode === "in" ? t("auth.signIn") : t("auth.signUp")}
          </Button>
        </form>

        <div className="my-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-[rgba(0,0,0,.18)]" />
          <span className="palace-eyebrow">{t("auth.or")}</span>
          <div className="h-px flex-1 bg-[rgba(0,0,0,.18)]" />
        </div>

        <Button
          type="button"
          variant="editorial"
          size="chip"
          onClick={submitGoogle}
          disabled={busy}
          className="w-full justify-center text-center"
        >
          {t("auth.continueGoogle")}
        </Button>

        <p className="mt-10 text-center palace-eyebrow">
          <Link to="/" className="uline text-[#000000]">{t("auth.backToExhibition")}</Link>
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

import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Logo } from "@/components/pawn/Logo";

export default function Auth() {
  const { user, loading, signInWithPassword, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/account" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } =
      mode === "in"
        ? await signInWithPassword(email, password)
        : await signUp(email, password, displayName || email.split("@")[0]);
    setBusy(false);
    if (error) return toast.error(error);
    if (mode === "up") toast.success("Check your email to confirm.");
    else navigate("/account");
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    setBusy(false);
    if (error) toast.error(error);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-4">
          <Logo className="h-10 w-auto" />
          <h1 className="sr-only">Enter PAWN</h1>
          <p className="text-sm text-muted-foreground text-center">
            Your identity, curated across a living wardrobe.
          </p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "in" | "up")}>
          <TabsList className="grid grid-cols-2 w-full mb-6 rounded-none border border-border bg-transparent">
            <TabsTrigger value="in" className="rounded-none">Sign in</TabsTrigger>
            <TabsTrigger value="up" className="rounded-none">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="in" className="mt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Email" value={email} onChange={setEmail} type="email" required />
              <Field label="Password" value={password} onChange={setPassword} type="password" required />
              <Button type="submit" className="w-full rounded-none" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="up" className="mt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Display name" value={displayName} onChange={setDisplayName} />
              <Field label="Email" value={email} onChange={setEmail} type="email" required />
              <Field label="Password" value={password} onChange={setPassword} type="password" required />
              <Button type="submit" className="w-full rounded-none" disabled={busy}>
                {busy ? "Creating…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full rounded-none"
          onClick={handleGoogle}
          disabled={busy}
        >
          Continue with Google
        </Button>
      </div>
    </main>
  );
}

function Field({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-widest">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="rounded-none border-border bg-transparent"
      />
    </div>
  );
}

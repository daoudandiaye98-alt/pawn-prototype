import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Ein einziger Sprachschalter für die ganze Seite. Die Sprache liegt global im
 * I18nProvider und wird im Browser gespeichert — ein Druck genügt, alle Seiten
 * folgen sofort und auch nach dem nächsten Besuch.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const next = locale === "de" ? "en" : "de";
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={t("nav.language")}
      title={t("nav.language")}
      className={cn(
        "flex min-h-[36px] items-center justify-center border border-border px-2.5 text-[0.62rem] uppercase tracking-[0.22em] transition-colors hover:bg-foreground hover:text-background",
        className,
      )}
    >
      {locale === "de" ? "DE → EN" : "EN → DE"}
    </button>
  );
}

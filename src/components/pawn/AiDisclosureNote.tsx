/**
 * Teil 39 AP3 — KI-VO Art. 50 Abs. 1: wer mit einem KI-System interagiert, muss darüber
 * informiert sein. Statt eines einmaligen, wegklickbaren Hinweises (der beim zweiten Besuch
 * schon vergessen ist) zeigt jede Gesprächsfläche diese eine ruhige Zeile immer — im Markenton,
 * mit einem Weg zu einem Menschen. "Immer da, nie im Weg": kein Modal, kein Badge, eine Zeile.
 */
import { useI18n } from "@/lib/i18n";

export function AiDisclosureNote({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p data-no-translate={false} className={`text-[0.68rem] leading-snug text-muted-foreground ${className}`}>
      {t("aiDisclosure.line")}{" "}
      <a href="mailto:pawnstudio.co@gmail.com" className="underline hover:text-foreground">{t("aiDisclosure.humanLink")}</a>
    </p>
  );
}

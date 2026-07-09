/**
 * Zahlungsart-Logos als reduzierte Wortmarken im PAWN-Stil (schwarz auf hell).
 * Wird unter dem Zur-Kasse-Button gezeigt.
 */
export function PaymentLogos({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[0.62rem] uppercase tracking-[0.24em] text-[#55534E] ${className}`}>
      <span>Apple Pay</span>
      <span className="opacity-40">·</span>
      <span>Google Pay</span>
      <span className="opacity-40">·</span>
      <span>PayPal</span>
      <span className="opacity-40">·</span>
      <span>Klarna</span>
      <span className="opacity-40">·</span>
      <span>Visa</span>
      <span className="opacity-40">·</span>
      <span>Mastercard</span>
    </div>
  );
}

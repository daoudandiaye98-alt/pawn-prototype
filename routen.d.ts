/**
 * Typen zu `routen.js`.
 *
 * Warum die Trennung? Weil `middleware.ts` diese Datei importiert und der
 * Bündler von Vercel den Import BUCHSTÄBLICH auflöst. Ein `./routen.js`, hinter
 * dem in Wahrheit ein `routen.ts` liegt, ist ein Kunstgriff, den TypeScript
 * versteht und ein fremder Bündler nicht versprechen muss — und wenn er ihn
 * nicht versteht, wird die Middleware stillschweigend weggelassen statt den
 * Build rot zu färben. Genau dieser stille Ausfall hat mehrere Läufe gekostet.
 *
 * Jetzt ist `routen.js` echtes JavaScript: der Import stimmt wörtlich, für
 * jeden Auflöser. Die Typen stehen hier daneben, damit alle Aufrufer sie
 * weiterhin bekommen.
 */

/** Jede Adresse, die das Heft kennt. `:name` steht für genau einen Abschnitt. */
export declare const ROUTEN: readonly string[];

/** Adressen, die nie durch die Middleware laufen sollen (Dateien, Plattform). */
export declare function istPlattformOderDatei(pfad: string): boolean;

/** Passt die Adresse auf eine echte Route? */
/** X1 — die Umzüge: alte Adresse → neue, 301 im Netz, Navigate in der App. */
export declare const UMZUEGE: readonly { von: string; nach: string }[];
export declare function istBekannteRoute(pfad: string): boolean;

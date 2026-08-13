import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/500-italic.css";
import "@fontsource/playfair-display/600-italic.css";
// Cormorant Garamond wird von Haus-Themen ("zart"/"warm") genutzt — bisher kam sie nur über
// den (entfernten) Google-Fonts-Link. Jetzt lokal wie die anderen Schriften.
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

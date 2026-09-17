import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
export const metadata: Metadata = { title: "Innovatis | Gestão de Cobranças", description: "Gestão de recebíveis IFES e GOV" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR" className={montserrat.variable}><body className="font-sans">{children}</body></html>;
}

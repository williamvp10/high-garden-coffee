import type { Metadata } from "next";
import Shell from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: "High Garden · Coffee Intelligence",
  description: "Predicciones, evidencia y un asistente experto en café",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

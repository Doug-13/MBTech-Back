import type { ReactNode } from "react";

export const metadata = {
  title: "MB Tech API",
  description: "Backend Next.js para MB Agenda IA",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

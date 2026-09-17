import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Stavira — Big goals. Right next step.',
  description:
    'Turn your goals into a plan that moves with you. Find the right next action for your time and energy.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import '@/index.css';

export const metadata = {
  title: 'EventPass — Event Registration & QR Tickets',
  description:
    'EventPass — register for events with Google and get a digital QR ticket instantly.',
  icons: { icon: 'https://db.com/logo_v2.svg' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

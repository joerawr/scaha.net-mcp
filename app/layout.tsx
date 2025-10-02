import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SCAHA MCP Server',
  description: 'Model Context Protocol server for Southern California Amateur Hockey Association data',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

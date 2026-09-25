import './globals.css';
import { EnvironmentBanner, SiteFooter } from './components/site-shell';
import { SiteHeader } from './components/site-header';

const indexAllowed = process.env.APP_MODE === 'live' && process.env.ROBOTS_INDEXING_ALLOWED === 'true';

export const metadata = {
  title: 'Bàn Gọn — phụ kiện góc làm việc',
  description: 'Shop demo phụ kiện bàn làm việc.',
  robots: { index: indexAllowed, follow: indexAllowed, googleBot: { index: indexAllowed, follow: indexAllowed } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>
    <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <EnvironmentBanner />
    <SiteHeader />
    <main id="main-content" tabIndex={-1}>{children}</main>
    <SiteFooter />
  </body></html>;
}

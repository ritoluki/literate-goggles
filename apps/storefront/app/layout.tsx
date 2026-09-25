import './globals.css';

export const metadata = { title: 'Bàn Gọn — phụ kiện góc làm việc', description: 'Shop demo phụ kiện bàn làm việc.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}

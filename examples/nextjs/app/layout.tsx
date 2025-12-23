import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Zilliz Cloud - Milvus Management',
  description: 'Manage your Zilliz Cloud databases and collections',
};

async function checkAuth() {
  const cookieStore = await cookies();
  const clientId = cookieStore.get('clientId')?.value;
  return !!clientId;
}

async function LogoutButton() {
  async function logout() {
    'use server';
    const cookieStore = await cookies();
    cookieStore.delete('clientId');
    redirect('/login');
  }

  return (
    <form action={logout}>
      <Button type="submit" variant="ghost">
        Logout
      </Button>
    </form>
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthenticated = await checkAuth();

  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-screen bg-gradient-to-b from-background to-muted/20`}>
        {isAuthenticated && (
          <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
              <Link href="/databases" className="text-xl font-semibold tracking-tight">
                Zilliz Cloud
              </Link>
              <div className="flex items-center gap-2">
                <Link href="/databases">
                  <Button variant="ghost" size="sm">Databases</Button>
                </Link>
                <LogoutButton />
              </div>
            </div>
          </nav>
        )}
        <main className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </body>
    </html>
  );
}

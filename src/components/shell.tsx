'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sun, Target, ChartNoAxesCombined, Settings, LogOut } from 'lucide-react';
import { Brand } from './ui';
import { api } from './api';
export function Shell({
  children,
  name,
  local,
}: {
  children: React.ReactNode;
  name: string;
  local: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <Brand />
        <nav aria-label="Main navigation">
          {[
            { url: '/today', label: 'Today', Icon: Sun },
            { url: '/goals', label: 'My goals', Icon: Target },
            { url: '/progress', label: 'Progress', Icon: ChartNoAxesCombined },
          ].map(({ url, label, Icon }) => (
            <Link
              key={url}
              href={url}
              className={path.startsWith(url) ? 'nav-link active' : 'nav-link'}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="account">
          <Link href="/settings" aria-label="Account settings" className="avatar">
            {name.slice(0, 1).toUpperCase()}
          </Link>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              await api('auth/signout', {});
              router.push('/signin');
              router.refresh();
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <main id="main" className="workspace">
        {children}
      </main>
      <footer className="app-footer">
        <span>Small steps. Meaningful progress.</span>
        <Link href="/settings">
          <Settings size={14} />
          {local ? 'Local development · fixture AI' : 'Your private workspace'}
        </Link>
      </footer>
    </>
  );
}

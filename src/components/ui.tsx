import { ArrowUpRight, Compass } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
export function Brand({ href = '/today' }: { href?: string }) {
  return (
    <Link href={href} className="brand">
      <Image src="/favicon.svg" alt="" width={44} height={44} className="brand-icon" priority />
      stavira<span className="brand-dot">.</span>
    </Link>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty">
      <Compass size={36} strokeWidth={1.2} />
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </div>
  );
}
export function GoalLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Link href={`/goals/${id}`} className="inline-link">
      {children}
      <ArrowUpRight size={16} />
    </Link>
  );
}

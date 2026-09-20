import Link from 'next/link';
import { ArrowRight, Check, Clock, Leaf, RefreshCw, Sun, Target, Zap } from 'lucide-react';
import { Brand } from '@/components/ui';
import { ContactModal } from '@/components/contact-modal';
import { hasSession } from '@/server/auth';
const VIBES = [
  { Icon: Zap, label: '15 min focus' },
  { Icon: Leaf, label: 'Low energy mode' },
  { Icon: Target, label: 'Deep dive' },
];
const STEPS = [
  { n: '01', label: 'Give your goal a direction' },
  { n: '02', label: 'Find a step that fits' },
  { n: '03', label: 'Learn as you move' },
];
const FEATURES = [
  {
    Icon: Sun,
    title: 'Adaptive to your energy',
    body: 'Filter actions by headspace, emotional energy, and available minutes. Advance your dreams even on sluggish days.',
  },
  {
    Icon: Zap,
    title: 'Micro-milestones',
    body: 'Deconstruct overwhelming monolithic targets into bite-sized 15-minute bursts that dissolve procrastination.',
  },
  {
    Icon: RefreshCw,
    title: 'Zero-guilt recalibration',
    body: 'Life happened? No red alerts or overdue badges. Stavira gracefully realigns your roadmap without punishment.',
  },
];
export default async function Landing() {
  const signedIn = await hasSession();
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-inner">
          <Brand href="/" />
          <nav className="landing-links" aria-label="Sections">
            <Link href="#how-it-works">How it works</Link>
            <Link href="#features">Features</Link>
          </nav>
          <div className="landing-actions">
            {signedIn ? (
              <Link href="/today" className="button primary">
                Go to your workspace <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link href="/signin" className="landing-signin">
                  Sign in <ArrowRight size={15} />
                </Link>
                <Link href="/signin?mode=signup" className="button primary">
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="landing-inner landing-grid">
            <div>
              <p className="badge">
                <span />A LITTLE DIRECTION GOES A LONG WAY
              </p>
              <h1>
                Big goals.
                <br />
                <em>Right next step.</em>
              </h1>
              <p className="landing-description">
                You know where you want to go. Find the next action that fits the time, energy, and
                headspace you have today.
              </p>
              <div className="hero-cta">
                <Link
                  href={signedIn ? '/today' : '/signin?mode=signup'}
                  className="button primary large"
                >
                  {signedIn ? 'Back to your next step' : 'Find your next step'}{' '}
                  <ArrowRight size={18} />
                </Link>
                <p className="landing-note">Your ambition. A plan that moves with you.</p>
              </div>
              <p className="eyebrow vibe-label">TODAY’S VIBE:</p>
              <ul className="vibe-chips">
                {VIBES.map(({ Icon, label }) => (
                  <li key={label}>
                    <Icon size={13} /> {label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="landing-preview">
              <div className="preview-top">
                <span className="preview-kicker">
                  <Target size={14} /> ONE STEP CLOSER
                </span>
                <small>Step 2 of 3</small>
              </div>
              <p className="eyebrow">YOUR GOAL</p>
              <h2>Build a portfolio that feels like you.</h2>
              <div className="preview-path">
                <div className="path-line done">
                  <span>
                    <Check size={13} />
                  </span>
                  Find your direction
                  <b className="tag done">Done</b>
                </div>
                <div className="path-line current">
                  <span>2</span>
                  Make it yours
                  <b className="tag current">In progress</b>
                </div>
                <div className="preview-action">
                  <div className="preview-action-top">
                    <p className="eyebrow">A SMALL STEP FOR TODAY</p>
                    <small>Micro-action</small>
                  </div>
                  <h3>Write your About section draft</h3>
                  <p className="preview-meta">
                    <Clock size={12} /> 20 minutes <i>·</i> Low energy <i>·</i> Draft mode
                  </p>
                  <div className="preview-action-foot">
                    <span className="preview-start">
                      Start step <ArrowRight size={13} />
                    </span>
                    <small>No deadline pressure</small>
                  </div>
                </div>
                <div className="path-line">
                  <span>3</span>
                  Bring it to life
                  <b className="tag muted">Locked</b>
                </div>
              </div>
              <p className="preview-caption">An example of how a big goal becomes doable.</p>
            </div>
          </div>
        </section>
        <section className="landing-steps" id="how-it-works">
          <div className="landing-inner">
            {STEPS.map(({ n, label }) => (
              <span key={n}>
                <i>{n}</i>
                {label}
              </span>
            ))}
          </div>
        </section>
        <section className="landing-features" id="features">
          <div className="landing-inner">
            <p className="eyebrow accent">DESIGNED DIFFERENTLY</p>
            <h2>Built for momentum, not burnout.</h2>
            <p className="features-lead">
              Standard task managers assume unlimited time and perfect focus. Stavira adapts to the
              real conditions of your day.
            </p>
            <div className="feature-grid">
              {FEATURES.map(({ Icon, title, body }) => (
                <article key={title}>
                  <span className="mini-icon">
                    <Icon size={18} />
                  </span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="landing-inner">
          <p>
            <Brand href="/" />
            <small>© {new Date().getFullYear()} Stavira Inc. All rights reserved.</small>
          </p>
          <div className="footer-links">
            <ContactModal />
          </div>
        </div>
      </footer>
    </div>
  );
}

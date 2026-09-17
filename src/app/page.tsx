import Link from 'next/link';
import { ArrowRight, Check, Compass } from 'lucide-react';
import { Brand } from '@/components/ui';
export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <Link href="/signin" className="button secondary">
          Sign in <ArrowRight size={16} />
        </Link>
      </header>
      <main className="landing-grid">
        <section>
          <p className="eyebrow">A LITTLE DIRECTION GOES A LONG WAY</p>
          <h1>
            Big goals.
            <br />
            <em>Right next step.</em>
          </h1>
          <p className="landing-description">
            You know where you want to go. Find the next action that fits the time, energy, and
            headspace you have today.
          </p>
          <Link href="/signin?mode=signup" className="button primary large">
            Find your next step <ArrowRight size={19} />
          </Link>
          <p className="landing-note">Your ambition. A plan that moves with you.</p>
        </section>
        <div className="landing-preview">
          <div className="preview-top">
            <Compass size={22} />
            <span>ONE STEP CLOSER</span>
          </div>
          <p className="eyebrow">YOUR GOAL</p>
          <h2>
            Build a portfolio
            <br />
            that feels like you.
          </h2>
          <div className="path-line">
            <span>
              <Check size={16} />
            </span>{' '}
            Find your direction
          </div>
          <div className="path-line current">
            <span>2</span> Make it yours
          </div>
          <div className="preview-action">
            <p className="eyebrow">A SMALL STEP FOR TODAY</p>
            <h3>Write your About section draft</h3>
            <p>
              20 minutes <span>·</span> Low energy
            </p>
          </div>
          <div className="path-line">
            <span>3</span> Bring it to life
          </div>
          <p className="preview-caption">An example of how a big goal becomes doable.</p>
        </div>
      </main>
      <div className="landing-bottom">
        <span>
          01 <b>Give your goal a direction</b>
        </span>
        <span>
          02 <b>Find a step that fits</b>
        </span>
        <span>
          03 <b>Learn as you move</b>
        </span>
      </div>
    </div>
  );
}

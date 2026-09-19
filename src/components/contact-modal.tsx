'use client';
import { useState } from 'react';
import { ArrowUpRight, Mail } from 'lucide-react';
import { Modal } from './modal';
function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}
function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17" aria-hidden="true">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.71-2.13 1.38C1.34 2.68.93 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.71 1.46 1.38 2.13.67.67 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.3 1.46-.71 2.13-1.38.67-.67 1.08-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.79-.71-1.46-1.38-2.13C21.32 1.34 20.65.93 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0z" />
      <path d="M12 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
      <circle cx="18.41" cy="5.59" r="1.44" />
    </svg>
  );
}
const CHANNELS = [
  {
    key: 'linkedin',
    name: 'LinkedIn',
    handle: 'in/rehanmehtaa',
    href: 'https://www.linkedin.com/in/rehanmehtaa/',
    Mark: LinkedInMark,
  },
  {
    key: 'instagram',
    name: 'Instagram',
    handle: '@rehan.protocol',
    href: 'https://www.instagram.com/rehan.protocol/',
    Mark: InstagramMark,
  },
  {
    key: 'gmail',
    name: 'Gmail',
    handle: 'rehanmehta@gmail.com',
    href: 'mailto:rehanmehta@gmail.com',
    Mark: () => <Mail size={17} />,
  },
];
export function ContactModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="footer-contact" onClick={() => setOpen(true)}>
        Contact Support
      </button>
      {open && (
        <Modal
          titleId="contact-title"
          className="contact-modal"
          dismissible
          onClose={() => setOpen(false)}
        >
          <h2 id="contact-title">Get in touch.</h2>
          <p className="muted">Reach out wherever suits you best — whichever you pick, it’s me.</p>
          <ul className="contact-options">
            {CHANNELS.map(({ key, name, handle, href, Mark }) => (
              <li key={key}>
                <a
                  href={href}
                  {...(href.startsWith('http')
                    ? { target: '_blank', rel: 'noreferrer noopener' }
                    : {})}
                >
                  <span className={`contact-icon ${key}`}>
                    <Mark />
                  </span>
                  <span className="contact-name">
                    {name}
                    <small>{handle}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </a>
              </li>
            ))}
          </ul>
          <button className="text-button" onClick={() => setOpen(false)}>
            Close
          </button>
        </Modal>
      )}
    </>
  );
}

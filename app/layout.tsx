import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Warpvio — Your website. Now an app.',
  description: 'Turn your website into an installable Windows, Android, or macOS app. One link, no code, one-time pricing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell">
          <header className="site-header" id="top">
            <a className="brand" href="#top" aria-label="Warpvio home">
              <span className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
              <span>warpvio<span className="brand-period">.</span></span>
            </a>
            <nav className="desktop-nav" aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#platforms">Platforms</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></nav>
            <a className="header-cta" href="#convert">Get started <span aria-hidden="true">↗</span></a>
            <button className="mobile-menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-navigation"><span></span><span></span><span></span></button>
          </header>
          <nav id="mobile-navigation" className="mobile-navigation" aria-label="Mobile navigation" hidden>
            <a href="#how-it-works">How it works</a><a href="#platforms">Platforms</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a>
          </nav>

          <main>{children}</main>

          <footer className="site-footer">
            <a className="brand" href="#top" aria-label="Warpvio home">
                <span className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
                <span>warpvio<span className="brand-period">.</span></span>
            </a>
            <p>From URL to app, beautifully simple.</p>
            <div className="footer-links">
                <a href="#how-it-works">How it works</a>
                <a href="#pricing">Pricing</a>
                <a href="#faq">FAQ</a>
                <a href="#faq" id="support-link">Help</a>
            </div>
            <div className="copyright">© {new Date().getFullYear()} Warpvio. All rights reserved.</div>
          </footer>
        </div>
      </body>
    </html>
  );
}

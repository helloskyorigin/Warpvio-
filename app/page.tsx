'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const selectedPlatforms = useRef(new Set(['Windows']));

  useEffect(() => {
    // Reveal animations
    const o = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            o.unobserve(e.target);
        }
    }), { threshold: .1 }) : null;
    document.querySelectorAll('.reveal').forEach(e => o ? o.observe(e) : e.classList.add('visible'));

    // Price button handling
    const handlePriceClick = (e: Event) => {
        const b = e.currentTarget as HTMLElement;
        selectedPlatforms.current.clear();
        (b.dataset.plan === 'All' ? ['Windows', 'Android', 'macOS'] : [b.dataset.plan as string]).forEach(x => selectedPlatforms.current.add(x));
        syncPlatforms();
        document.querySelector('#convert')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    document.querySelectorAll('.price-button').forEach(b => b.addEventListener('click', handlePriceClick));

    // Platform selection logic
    const syncPlatforms = () => {
        document.querySelectorAll('.platform-option').forEach(b => {
            const btn = b as HTMLElement;
            const p = btn.dataset.platform as string;
            const yes = selectedPlatforms.current.has(p);
            btn.classList.toggle('selected', yes);
            btn.setAttribute('aria-pressed', String(yes));
        });
    };

    document.querySelectorAll('.platform-option').forEach(b => b.addEventListener('click', (e) => {
        const btn = e.currentTarget as HTMLElement;
        const p = btn.dataset.platform as string;
        if (selectedPlatforms.current.has(p)) {
            if (selectedPlatforms.current.size > 1) selectedPlatforms.current.delete(p);
        } else {
            selectedPlatforms.current.add(p);
        }
        syncPlatforms();
    }));

    // Mobile menu
    const menu = document.querySelector('.mobile-menu-btn') as HTMLElement;
    const nav = document.querySelector('.mobile-navigation') as HTMLElement;
    menu?.addEventListener('click', () => {
        const opened = menu.getAttribute('aria-expanded') === 'true';
        menu.setAttribute('aria-expanded', String(!opened));
        menu.setAttribute('aria-label', opened ? 'Open menu' : 'Close menu');
        nav.hidden = opened;
    });

    return () => {
        document.querySelectorAll('.price-button').forEach(b => b.removeEventListener('click', handlePriceClick));
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = url.trim();
    if (!text) {
        setError('Enter your website URL to continue.');
        return;
    }
    
    // Simple validation (can be enhanced with the original regex)
    setError('');
    
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: JSON.stringify({ url: text, platforms: [...selectedPlatforms.current] }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        if (!data.ok) throw new Error(data.error);

        sessionStorage.setItem('warpvio_v1_request', JSON.stringify({ url: text, platforms: [...selectedPlatforms.current] }));
        sessionStorage.removeItem('warpvio_v1_result');
        location.assign('./analyzing.html');
    } catch (err: any) {
        setError(err.message || 'An error occurred.');
    }
  };

  return (
    <>
      <section className="hero" id="convert" aria-labelledby="hero-title">
        <div className="hero-ambient" aria-hidden="true"></div>
        <div className="hero-content">
          <div className="eyebrow"><span className="eyebrow-dot"></span> THE SIMPLEST WAY FROM WEB TO APP</div>
          <h1 id="hero-title">Your website.<br /><span>Now an app.</span></h1>
          <p className="hero-subtitle">Give your website a place on every desktop and phone.<br className="desktop-break" /> No code. No complicated setup. Just your URL.</p>
          <form className="convert-form" id="convert-form" onSubmit={handleSubmit} noValidate>
            <label className="input-label" htmlFor="website-url">YOUR WEBSITE</label>
            <div className="url-field">
                <svg className="url-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3A5 5 0 0 0 13 2.93l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.71-1.71"/></svg>
                <input id="website-url" name="url" type="url" inputMode="url" autoComplete="url" placeholder="https://yourwebsite.com" aria-describedby="url-error" required value={url} onChange={(e) => setUrl(e.target.value)} />
                <button type="submit" className="url-submit" aria-label="Continue with website"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7" /></svg></button>
            </div>
            <p className="input-error" id="url-error" role="alert" aria-live="polite">{error}</p>
            <div className="platform-bar"><span className="platform-label">BUILD FOR</span>
                <div className="platform-choices" role="group" aria-label="Select target platforms">
                    <button type="button" className="platform-option selected" data-platform="Windows" aria-pressed="true"><svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M2 4.3 10.8 3v8.2H2V4.3Zm9.9-1.5L22 1.4v9.8H11.9V2.8ZM2 12.3h8.8v8.2L2 19.2v-6.9Zm9.9 0H22v9.9l-10.1-1.4v-8.5Z" /></svg>Windows<span className="option-check">✓</span></button>
                    <button type="button" className="platform-option" data-platform="Android" aria-pressed="false"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8Zm-2 3v6m16-6v6M8 3 6 1m10 2 2-2"/><path d="M9 10h.01M15 10h.01" strokeWidth="2.6" /></svg>Android<span className="option-check">✓</span></button>
                    <button type="button" className="platform-option" data-platform="macOS" aria-pressed="false"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>macOS<span className="option-check">✓</span></button>
                </div>
            </div>
            <button type="submit" className="main-cta">Convert my website <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></button>
            <p className="hero-note"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>Free to preview <span className="separator-dot">·</span> Pay once to export <span className="separator-dot">·</span> No subscription</p>
          </form>
        </div>
        <a href="#how-it-works" className="scroll-hint">EXPLORE HOW IT WORKS <span aria-hidden="true">↓</span></a>
      </section>

      <section className="intro-strip" aria-label="Benefits"><div className="strip-item"><span className="strip-icon">↗</span><span>From URL to installable app</span></div><div className="strip-divider"></div><div className="strip-item"><span className="strip-icon">✳</span><span>Make it yours</span></div><div className="strip-divider"></div><div className="strip-item"><span className="strip-icon">◎</span><span>One-time purchase</span></div></section>

      <section className="section how-section" id="how-it-works"><div className="section-heading reveal"><p className="section-kicker">A BETTER WAY TO BUILD</p><h2>From a link to an app.<br /><span>That simple.</span></h2><p>No SDKs, no build tools, no terminal. Just a straightforward path from your website to a downloadable app.</p></div><div className="steps-grid"><article className="step-card reveal"><div className="step-number">01</div><div className="step-visual step-visual-url"><div className="mini-address"><span>🔗</span> yourwebsite.com <span>↗</span></div><div className="mini-glow"></div></div><h3>Paste your link</h3><p>Enter your live website and choose the devices you'd like to support.</p></article><article className="step-card reveal"><div className="step-number">02</div><div className="step-visual step-visual-custom"><div className="app-tile"><span className="app-tile-mark">w.</span></div><div className="paint-chip paint-one"></div><div className="paint-chip paint-two"></div></div><h3>Make it yours</h3><p>Choose your app's name, icon and appearance. Preview it before paying.</p></article><article className="step-card reveal"><div className="step-number">03</div><div className="step-visual step-visual-ready"><div className="download-mini"><div className="download-check">✓</div><div><strong>Your app is ready</strong><small>Installable package</small></div><span>↓</span></div></div><h3>Download your app</h3><p>Pay once for your selected build and download your finished package.</p></article></div></section>

      <section className="section showcase-section" id="platforms"><div className="showcase-grid"><div className="showcase-copy reveal"><p className="section-kicker">ONE WEBSITE, MORE PLACES</p><h2>Give your website<br /><span>its own icon.</span></h2><p>Your existing website, in an installable app experience built for the platforms that matter.</p><div className="showcase-points"><div><span className="point-icon">✓</span> Keep your existing website and backend</div><div><span className="point-icon">✓</span> Customize the app identity</div><div><span className="point-icon">✓</span> No recurring Warpvio platform fee</div></div><a href="#convert" className="text-link">Start with your URL <span>↗</span></a></div><div className="device-stage reveal" aria-label="Windows and Android app illustration"><div className="device-ambient"></div><div className="desktop-device"><div className="window-head"><span className="window-dots"><i></i><i></i><i></i></span><span>yourwebsite.com</span><span>↗</span></div><div className="mock-top"><span className="mock-logo">studio<span>✦</span></span><span>Menu&nbsp; · &nbsp;About</span></div><div className="mock-body"><span className="mock-tag">YOUR BRAND, EVERYWHERE</span><strong>Beautiful ideas.<br /><em>Better experiences.</em></strong><span className="mock-button">Get started ↗</span></div></div><div className="phone-device"><div className="phone-notch"></div><div className="phone-screen"><div className="phone-brand">studio<span>✦</span></div><div className="phone-art"></div><strong>Make it<br />yours.</strong><div className="phone-btn"></div></div></div><div className="mac-icon" aria-hidden="true">✦</div></div></div></section>

      <section className="section freedom-section"><div className="section-heading reveal"><p className="section-kicker">MADE TO FEEL EFFORTLESS</p><h2>Everything you need.<br /><span>Nothing you don't.</span></h2></div><div className="feature-grid"><article className="feature-card reveal"><div className="feature-icon lavender">⌘</div><h3>Your brand, front and center.</h3><p>Your app name, icon and launch experience — designed around your identity.</p></article><article className="feature-card reveal"><div className="feature-icon blue">◇</div><h3>Your site stays yours.</h3><p>Keep your website exactly where it is. App wrappers connect to your existing live website.</p></article><article className="feature-card reveal"><div className="feature-icon lilac">↗</div><h3>Built for real devices.</h3><p>Download Windows, Android and macOS packages when each build passes validation.</p></article></div></section>

      <section className="section pricing-section" id="pricing"><div className="section-heading reveal"><p className="section-kicker">SIMPLE PRICING</p><h2>One payment.<br /><span>Your app, yours.</span></h2><p>No monthly Warpvio subscription. Choose the platform you need and pay only when you're ready to export.</p></div><div className="pricing-grid"><article className="price-card reveal"><span className="price-card-top">DESKTOP</span><h3>Windows</h3><div className="price">$15 <span>/ one-time</span></div><p>An installable Windows application for your website.</p><div className="price-rule"></div><div className="price-feature">✓ &nbsp; Windows app package</div><div className="price-feature">✓ &nbsp; Custom name &amp; icon</div><div className="price-feature">✓ &nbsp; 30-day download access</div><button className="price-button" data-plan="Windows">Choose Windows <span>↗</span></button></article><article className="price-card featured reveal"><div className="popular-label">BEST VALUE</div><span class="price-card-top">ALL PLATFORMS</span><h3>Everything</h3><div className="price">$39 <span>/ one-time</span></div><p>Your website, packaged for Windows, Android and macOS.</p><div className="price-rule"></div><div className="price-feature">✓ &nbsp; All three app packages</div><div className="price-feature">✓ &nbsp; Custom name &amp; icon</div><div className="price-feature">✓ &nbsp; 30-day download access</div><button className="price-button featured-button" data-plan="All">Choose all platforms <span>↗</span></button></article><article className="price-card reveal"><span className="price-card-top">MOBILE</span><h3>Android</h3><div className="price">$19 <span>/ one-time</span></div><p>An installable Android APK for your website.</p><div className="price-rule"></div><div className="price-feature">✓ &nbsp; One selected platform</div><div className="price-feature">✓ &nbsp; Custom name &amp; icon</div><div className="price-feature">✓ &nbsp; 30-day download access</div><button className="price-button" data-plan="Android">Choose Android <span>↗</span></button></article><article className="price-card reveal"><span className="price-card-top">DESKTOP</span><h3>macOS</h3><div className="price">$19 <span>/ one-time</span></div><p>An installable macOS app package for your website.</p><div className="price-rule"></div><div className="price-feature">✓ &nbsp; macOS app package</div><div className="price-feature">✓ &nbsp; Custom name &amp; icon</div><div className="price-feature">✓ &nbsp; 30-day download access</div><button className="price-button" data-plan="macOS">Choose macOS <span>↗</span></button></article></div><p className="pricing-disclaimer">Pricing shown is proposed for launch. Build availability, compatibility and final deliverables are confirmed before checkout. No free exports.</p></section>

      <section className="section faq-section" id="faq"><div className="faq-layout"><div className="reveal"><p className="section-kicker">GOOD TO KNOW</p><h2>A few things<br /><span>worth knowing.</span></h2><p className="faq-aside">Still curious? We're keeping the process simple and the details transparent.</p></div><div className="faq-list reveal"><details><summary>Will my website work without internet?<span>+</span></summary><p>No. Warpvio's V1 packages your existing live website into an app shell. Your website and its backend must stay online.</p></details><details><summary>Do I need to know how to code?<span>+</span></summary><p>No coding is needed to use the converter. Some websites may have compatibility limitations, which we show before payment.</p></details><details><summary>Do I pay every month?<span>+</span></summary><p>No. Each purchase covers a defined app build for one website and the platform(s) selected. Your existing website hosting is separate.</p></details><details><summary>Can I publish to the Play Store or Mac App Store?<span>+</span></summary><p>Store publishing isn't included in V1. Store submission, signing and platform policies may require additional steps or developer accounts.</p></details><details><summary>What happens if a build fails?<span>+</span></summary><p>A failed build should be retried or resolved through support; if a compatible paid build cannot be delivered, the purchase should be refunded under the published policy.</p></details></div></div></section>
      <section className="end-banner reveal"><p className="section-kicker">LET'S MAKE IT REAL</p><h2>That link deserves<br /><span>an app icon.</span></h2><a href="#convert" className="main-cta banner-cta">Create your app <span>↗</span></a></section>
    </>
  );
}

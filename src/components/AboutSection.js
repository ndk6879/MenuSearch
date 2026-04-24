import React from "react";

const KakaoIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#FFE812"/>
    <path d="M12 5C7.58 5 4 7.86 4 11.4c0 2.24 1.48 4.2 3.72 5.33l-.95 3.54 4.1-2.72c.36.05.73.08 1.13.08 4.42 0 8-2.86 8-6.4S16.42 5 12 5z" fill="#391B1B"/>
  </svg>
);

const InstagramGradientIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#fdf497" />
        <stop offset="5%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" />
        <stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#ig-grad)" />
    <circle cx="12" cy="12" r="4.6" stroke="white" strokeWidth="1.8" fill="none" />
    <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
  </svg>
);

const YouTubeIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5.5" fill="#FF0000"/>
    <path d="M19.6 8.2a2 2 0 0 0-1.4-1.4C16.9 6.5 12 6.5 12 6.5s-4.9 0-6.2.3a2 2 0 0 0-1.4 1.4C4.1 9.5 4.1 12 4.1 12s0 2.5.3 3.8a2 2 0 0 0 1.4 1.4c1.3.3 6.2.3 6.2.3s4.9 0 6.2-.3a2 2 0 0 0 1.4-1.4c.3-1.3.3-3.8.3-3.8s0-2.5-.3-3.8z" fill="white"/>
    <path d="M10.2 14.5V9.5l4.2 2.5-4.2 2.5z" fill="#FF0000"/>
  </svg>
);

export default function AboutSection({ darkMode, t, chefProfile }) {
  if (chefProfile) {
    return (
      <section id="about" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
        <a
          href={chefProfile.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`about-chef-yt-btn${darkMode ? " dark" : ""}`}
        >
          <YouTubeIcon size={18} />
          {chefProfile.displayName} 유튜브 채널 보기
        </a>
      </section>
    );
  }

  return (
    <section id="about" className={`about-section${darkMode ? " dark" : ""}`}>
      {/* Story */}
      <div className="about-story">
        <p className="about-story-eyebrow">{t.aboutEyebrow}</p>
        <h2 className="about-story-title">
          {t.aboutTitle.split("\n").map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </h2>
        <p className="about-story-body">
          {t.aboutBody.split("\n\n").map((para, i) => (
            <span key={i}>
              {para.split("\n").map((line, j) => (
                <span key={j}>{line}{j < para.split("\n").length - 1 && <br />}</span>
              ))}
              {i < t.aboutBody.split("\n\n").length - 1 && <><br /><br /></>}
            </span>
          ))}
        </p>
      </div>

      {/* Features */}
      <div className="about-features">
        <p className="about-section-label">{t.featuresLabel}</p>
        <div className="about-features-grid">
          {t.features.map((f) => (
            <div key={f.title} className={`about-feature-card${f.comingSoon ? " about-feature-card--coming-soon" : ""}`}>
              <span className="about-feature-icon">{f.icon}</span>
              <h3 className="about-feature-title">{f.title}</h3>
              <p className="about-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="about-cta">
        <p className="about-section-label">{t.contactLabel}</p>
        <h2 className="about-cta-title">{t.contactTitle}</h2>
        <p className="about-cta-body">{t.contactBody}</p>
        <div className="about-cta-links">
          <div className="about-cta-contact-row">
            <span className="about-cta-contact-icon"><InstagramGradientIcon size={20} /></span>
            <a href="https://www.instagram.com/andy__yeyo/" target="_blank" rel="noopener noreferrer" className="about-cta-contact-link">andy__yeyo</a>
          </div>
          <div className="about-cta-contact-row">
            <span className="about-cta-contact-icon"><KakaoIcon size={20} /></span>
            <a href="https://open.kakao.com/o/sLh3Asoi" target="_blank" rel="noopener noreferrer" className="about-cta-contact-link">1:1 오픈채팅</a>
          </div>
          <div className="about-cta-contact-row">
            <span className="about-cta-contact-icon">✉️</span>
            <a href="mailto:ndk68790@gmail.com" className="about-cta-contact-link">ndk68790@gmail.com</a>
          </div>
        </div>
      </div>
    </section>
  );
}

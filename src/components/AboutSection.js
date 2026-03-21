import React from "react";
import { FaGithub, FaInstagram } from "react-icons/fa";

export default function AboutSection({ darkMode, t }) {
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
            <div key={f.title} className="about-feature-card">
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
          <a
            href="https://github.com/ndk6879/MenuSearch"
            target="_blank"
            rel="noopener noreferrer"
            className="about-cta-btn about-cta-btn-primary"
          >
            <FaGithub size={16} />
            GitHub
          </a>
          <a
            href="https://www.instagram.com/andy__yeyo/"
            target="_blank"
            rel="noopener noreferrer"
            className="about-cta-btn about-cta-btn-secondary"
          >
            <FaInstagram size={16} />
            Instagram
          </a>
        </div>
      </div>
    </section>
  );
}

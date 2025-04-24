import React from "react";
import "./HeroSection.css";

export default function HeroSubSections() {
  return (
    <section className="sub-hero-section text-white px-6 py-32 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-0"></div>
      <div className="relative z-10 max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          A new business for chefs.<br />
          World-class recipes for everyone.
        </h2>
        <p className="text-lg md:text-xl text-gray-300">
          “Cooking should be joyful. It doesn't have to be perfect. It's already special as it is.”
        </p>
      </div>
    </section>
  );
}

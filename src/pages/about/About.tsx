import React, { useRef, useEffect } from "react";
import { TreeNavigation } from "../../components/TreeNavigation/TreeNavigation";
import { PageFrame } from "../../components/PageFrame/PageFrame";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./About.css";

gsap.registerPlugin(ScrollTrigger);

export const About: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hero Title Animation: Split or staggered reveal
    const ctx = gsap.context(() => {
      // Hero reveal
      gsap.from(".hero-title", {
        y: 100,
        opacity: 0,
        duration: 2,
        ease: "expo.out",
        delay: 0.5
      });

      gsap.from(".hero-subtitle", {
        y: 50,
        opacity: 0,
        duration: 1.5,
        ease: "power3.out",
        delay: 1
      });

      // Features Parallax/Stagger
      const features = gsap.utils.toArray(".feature-item") as HTMLElement[];
      gsap.from(features, {
        scrollTrigger: {
          trigger: ".features-grid",
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse",
        },
        y: 100,
        opacity: 0,
        scale: 0.9,
        stagger: 0.2,
        duration: 1.2,
        ease: "back.out(1.2)"
      });

      // Feature Item Hover Effect (GSAP variant)
      features.forEach((item) => {
        item.addEventListener("mouseenter", () => {
          gsap.to(item, { y: -15, scale: 1.05, boxShadow: "0 30px 60px rgba(0,0,0,0.1)", duration: 0.4 });
        });
        item.addEventListener("mouseleave", () => {
          gsap.to(item, { y: 0, scale: 1, boxShadow: "0 10px 30px rgba(0,0,0,0.05)", duration: 0.4 });
        });
      });

      // Tree Divider Reveal
      gsap.from(".divider-line", {
        scrollTrigger: {
          trigger: ".tree-divider",
          start: "top 90%",
        },
        scaleX: 0,
        stagger: 0.5,
        duration: 2,
        ease: "expo.inOut"
      });

      gsap.from(".divider-text", {
        scrollTrigger: {
          trigger: ".tree-divider",
          start: "top 90%",
        },
        opacity: 0,
        letterSpacing: "20px",
        duration: 1.5,
        ease: "power2.out"
      });

      // Navigation staggered reveal
      gsap.from(".tree-navigation-container > *", {
        scrollTrigger: {
          trigger: ".navigation-section",
          start: "top 70%",
        },
        y: 50,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        ease: "power3.out"
      });

    }, containerRef); // Scope GSAP to this container

    return () => ctx.revert(); // Cleanup GSAP on unmount
  }, []);

  return (
    <PageFrame>
      <div className="about" ref={containerRef}>
        <div className="about-content">
          {/* Hero Section */}
          <section className="hero-section" ref={heroRef}>
            <h1 className="hero-title">Цифровая Эстетика</h1>
            <p className="hero-subtitle">Пространство для размышлений, творчества и глубокого погружения в смыслы.</p>
          </section>

          {/* Features Section */}
          <section className="features-section" ref={featuresRef}>
            <div className="features-grid">
              <div className="feature-item">
                <div className="feature-number">01</div>
                <div className="feature-label">пост в день</div>
              </div>

              <div className="feature-item">
                <div className="feature-number">∞</div>
                <div className="feature-label">слов в словаре</div>
              </div>

              <div className="feature-item">
                <div className="feature-number">00</div>
                <div className="feature-label">редактирований</div>
              </div>
            </div>
          </section>

          {/* Navigation Section */}
          <section className="navigation-section" ref={navigationRef}>
            <div className="tree-divider">
              <div className="divider-line" />
              <div className="divider-text">навигация</div>
              <div className="divider-line" />
            </div>
            <div className="tree-navigation-container">
              <TreeNavigation />
            </div>
          </section>
        </div>
      </div>
    </PageFrame>
  );
};

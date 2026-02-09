import React, { useRef, useLayoutEffect } from "react";
import { TreeNavigation } from "../../components/TreeNavigation/TreeNavigation";
import { PageFrame } from "../../components/PageFrame/PageFrame";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./About.css";
import { useLoader } from "../../contexts/LoaderContext";

gsap.registerPlugin(ScrollTrigger);

export const About: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);

  const { isLoaded } = useLoader();

  useLayoutEffect(() => {
    if (!isLoaded) return;

    let ctx: gsap.Context;
    // Small delay to ensure Lenis and DOM are ready
    const timer = setTimeout(() => {
      ctx = gsap.context(() => {
        // 1. Hero Animations
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

        // 1.1 Logo Filling Animation
        const logoTL = gsap.timeline({
          scrollTrigger: {
            trigger: ".hero-section",
            start: "top top",
            end: "bottom top",
            scrub: 0.5,
          }
        });

        logoTL.to(".logo-fill-layer", {
          clipPath: "inset(0% 0% 0% 0%)", // Fully revealed
          ease: "none"
        })
          .to(".hero-logo-container", {
            scale: 0.95,
            opacity: 0.1,
            y: -30,
            filter: "blur(10px)",
            ease: "none"
          }, 0.5);

        // 2. Features Animation
        const features = gsap.utils.toArray(".feature-item") as HTMLElement[];
        gsap.from(features, {
          scrollTrigger: {
            trigger: ".features-section",
            start: "top 70%",
            toggleActions: "play none none reverse",
          },
          y: 80,
          opacity: 0,
          scale: 0.95,
          stagger: 0.15,
          duration: 1,
          ease: "back.out(1.2)"
        });

        // Feature Item Hover Effect
        features.forEach((item) => {
          item.addEventListener("mouseenter", () => {
            gsap.to(item, { y: -10, scale: 1.02, boxShadow: "0 20px 40px rgba(0,0,0,0.08)", duration: 0.3 });
          });
          item.addEventListener("mouseleave", () => {
            gsap.to(item, { y: 0, scale: 1, boxShadow: "0 10px 30px rgba(0,0,0,0.05)", duration: 0.3 });
          });
        });

        // 3. Navigation/Divider Animation
        gsap.from(".divider-line", {
          scrollTrigger: {
            trigger: ".tree-divider",
            start: "top 90%",
          },
          scaleX: 0,
          stagger: 0.4,
          duration: 1.5,
          ease: "expo.inOut"
        });

        gsap.from(".divider-text", {
          scrollTrigger: {
            trigger: ".tree-divider",
            start: "top 90%",
          },
          opacity: 0,
          letterSpacing: "40px",
          duration: 1.2,
          ease: "power2.out"
        });

        gsap.from(".tree-navigation-container > *", {
          scrollTrigger: {
            trigger: ".navigation-section",
            start: "top 80%",
          },
          y: 30,
          opacity: 0,
          stagger: 0.1,
          duration: 0.8,
          ease: "power3.out"
        });

        // 4. THREE-STAGE SCROLL SNAPPING (Desktop Only)
        ScrollTrigger.matchMedia({
          "(min-width: 1025px)": function () {
            ScrollTrigger.create({
              trigger: ".about-content",
              start: "top top",
              end: "bottom bottom",
              snap: {
                snapTo: [0, 0.5, 1],
                duration: { min: 0.4, max: 0.6 },
                delay: 0.1,
                ease: "power1.inOut"
              }
            });
          }
        });


        ScrollTrigger.refresh();
      }, containerRef);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (ctx) ctx.revert();
    };
  }, [isLoaded]);

  return (
    <PageFrame>
      <div className="about" ref={containerRef} style={{ visibility: isLoaded ? 'visible' : 'hidden' }}>
        <div className="about-content">
          {/* STAGE 1: Hero */}
          <section className="hero-section" ref={heroRef}>
            <div className="hero-logo-container">
              <img
                src="/logo [Vectorized].svg"
                alt="Voltri Logo Base"
                className="hero-logo-base"
              />
              <img
                src="/logo [Vectorized].svg"
                alt="Voltri Logo Fill"
                className="hero-logo-fill logo-fill-layer"
              />
            </div>
            <div className="header-details">
              <div className="detail-top-bar">
                <span className="detail-tag">INDEX.VOL_3</span>
                <span className="detail-line" />
                <span className="detail-status">ALMANAC_LIVE</span>
              </div>
              <div className="corner-mark top-left" />
              <div className="corner-mark top-right" />
              <div className="corner-mark bottom-left" />
              <div className="corner-mark bottom-right" />
              <div className="side-label">PUBLIC_DOMAIN_PROJECT</div>
            </div>
            <h1 className="hero-title">web-almanac</h1>
            <p className="hero-subtitle">Проект свободного распространения е-литературы</p>
          </section>


          {/* STAGE 2: Features */}
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

          {/* STAGE 3: Navigation */}
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

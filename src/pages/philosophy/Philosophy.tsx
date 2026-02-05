import React, { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageFrame } from "../../components/PageFrame/PageFrame";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./Philosophy.css";

gsap.registerPlugin(ScrollTrigger);

export const Philosophy: React.FC = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const ctx = gsap.context(() => {
        // 1. Hero Animations
        gsap.from(".hero-title-phi", {
          y: 100,
          opacity: 0,
          duration: 2,
          ease: "expo.out",
          delay: 0.5
        });

        gsap.from(".hero-subtitle-phi", {
          y: 50,
          opacity: 0,
          duration: 1.5,
          ease: "power3.out",
          delay: 1
        });

        // 2. Sections Staggered Reveal
        const sections = gsap.utils.toArray(".philosophy-section-snap") as HTMLElement[];
        sections.forEach((section, i) => {
          if (i === 0) return; // Skip hero

          gsap.from(section.querySelectorAll(".anim-up"), {
            scrollTrigger: {
              trigger: section,
              start: "top 70%",
              toggleActions: "play none none reverse",
            },
            y: 50,
            opacity: 0,
            stagger: 0.2,
            duration: 1,
            ease: "power3.out"
          });
        });

        // 3. Principles Animation
        gsap.from(".principle-card", {
          scrollTrigger: {
            trigger: ".principles-grid",
            start: "top 70%",
          },
          y: 80,
          opacity: 0,
          scale: 0.95,
          stagger: 0.2,
          duration: 1.2,
          ease: "back.out(1.4)"
        });

        // 4. Snap Scrolling
        ScrollTrigger.create({
          trigger: ".philosophy-content-snap",
          start: "top top",
          end: "bottom bottom",
          snap: {
            snapTo: [0, 0.25, 0.5, 0.75, 1],
            duration: { min: 0.4, max: 0.6 },
            delay: 0.1,
            ease: "power1.inOut"
          }
        });

        // 5. Scroll Path Fill Animation
        gsap.to(".scroll-path-fill", {
          scrollTrigger: {
            trigger: ".philosophy-content-snap",
            start: "top top",
            end: "bottom bottom",
            scrub: 1, // Smooth following
          },
          scaleY: 1,
          backgroundColor: "#ffffff",
          boxShadow: "0 0 15px rgba(255, 255, 255, 0.8)",
          ease: "none"
        });

        ScrollTrigger.refresh();
      }, containerRef);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <PageFrame>
      <div className="philosophy" ref={containerRef}>
        <div className="philosophy-content-snap">
          {/* The "Electric Tree" Trunk Path */}
          <div className="scroll-path-track">
            <div className="scroll-path-fill" />
          </div>

          {/* STAGE 1: Hero */}
          <section className="philosophy-section-snap hero-phi">
            <h1 className="hero-title-phi">Vol-3 philosophy</h1>
            <p className="hero-subtitle-phi">Пространство осознанного общения и личного языка</p>
          </section>

          {/* STAGE 2: Concept */}
          <section className="philosophy-section-snap concept-phi">
            <div className="content-inner">
              <h2 className="anim-up">электрическое дерево</h2>
              <div className="anim-up desc-text">
                <p>
                  вольтри — это не просто сеть. Это пространство, где каждое слово имеет вес.
                  Мы называем его «электрическим деревом»: как дерево растет медленно,
                  так и ваши мысли здесь требуют времени и внимания.
                </p>
                <p>
                  Каждый импульс — это разряд, который остается в пространстве навсегда,
                  формируя вашу историю и ваш собственный язык.
                </p>
              </div>
            </div>
          </section>

          {/* STAGE 3: Principles */}
          <section className="philosophy-section-snap principles-phi">
            <div className="principles-grid">
              <div className="principle-card">
                <div className="p-number">01</div>
                <div className="p-title">Осознанность</div>
                <div className="p-desc">Каждое слово — это ваш выбор. Качество важнее количества.</div>
              </div>
              <div className="principle-card">
                <div className="p-number">02</div>
                <div className="p-title">Размеренность</div>
                <div className="p-desc">Один пост в день — это ритм, который позволяет дышать.</div>
              </div>
              <div className="principle-card">
                <div className="p-number">03</div>
                <div className="p-title">Самопознание</div>
                <div className="p-desc">Ваш словарик — это зеркало вашего внутреннего мира.</div>
              </div>
            </div>
          </section>

          {/* STAGE 4: Freedom through Constraints */}
          <section className="philosophy-section-snap constraints-phi">
            <div className="content-inner">
              <h2 className="anim-up">ограничения как свобода</h2>
              <div className="phi-list anim-up">
                <div className="phi-list-item">
                  <span>один пост в день</span>
                  <p>учит выбирать главное</p>
                </div>
                <div className="phi-list-item">
                  <span>без редактирования</span>
                  <p>учит ответственности</p>
                </div>
                <div className="phi-list-item">
                  <span>без удаления</span>
                  <p>создает честную историю</p>
                </div>
              </div>
            </div>
          </section>

          {/* STAGE 5: Conclusion */}
          <section className="philosophy-section-snap footer-phi">
            <div className="footer-phi-content anim-up">
              <div className="tree-divider-phi">
                <div className="divider-line-phi" />
                <div className="divider-text-phi">путь</div>
                <div className="divider-line-phi" />
              </div>
              <p className="final-quote">
                используйте вольтри-язык, и просто оставайтесь здесь столько,
                сколько пожелаете
              </p>
              <p className="final-sub">это не гонка. это путь.</p>
            </div>
          </section>
        </div>
      </div>
    </PageFrame>
  );
};

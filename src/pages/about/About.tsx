import React, { useRef, useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TreeNavigation } from "../../components/TreeNavigation/TreeNavigation";
import { PageFrame } from "../../components/PageFrame/PageFrame";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./About.css";
import { useLoader } from "../../contexts/LoaderContext";
import { useOnboarding } from "../../components/Onboarding/OnboardingContext";
import { useMusic } from "../../contexts/MusicContext";

gsap.registerPlugin(ScrollTrigger);

// «о проекте» and «философия» used to be two pages telling the same story twice
// (one post a day, no editing). Now it is one story: what it is → why → the rules → the way in.
export const About: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);

  const { isLoaded } = useLoader();
  const location = useLocation();
  const navigate = useNavigate();
  const { guest, openGuide } = useOnboarding();
  const { playButtonSound } = useMusic();
  const section = (location.state as { section?: string } | null)?.section;

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

        // 2. Story sections: their lines come up one after another
        const sections = gsap.utils.toArray(".about-section") as HTMLElement[];
        sections.forEach((s) => {
          gsap.from(s.querySelectorAll(".anim-up"), {
            scrollTrigger: {
              trigger: s,
              start: "top 70%",
              toggleActions: "play none none reverse",
            },
            y: 50,
            opacity: 0,
            stagger: 0.15,
            duration: 1,
            ease: "power3.out"
          });
        });

        // 3. Rule cards
        const cards = gsap.utils.toArray(".rule-card") as HTMLElement[];
        gsap.from(cards, {
          scrollTrigger: {
            trigger: ".rules-grid",
            start: "top 75%",
            toggleActions: "play none none reverse",
          },
          y: 80,
          opacity: 0,
          scale: 0.95,
          stagger: 0.15,
          duration: 1,
          ease: "back.out(1.2)"
        });

        // Card Hover Effect
        cards.forEach((item) => {
          item.addEventListener("mouseenter", () => {
            gsap.to(item, { y: -10, scale: 1.02, boxShadow: "0 20px 40px rgba(0,0,0,0.08)", duration: 0.3 });
          });
          item.addEventListener("mouseleave", () => {
            gsap.to(item, { y: 0, scale: 1, boxShadow: "0 10px 30px rgba(0,0,0,0.04)", duration: 0.3 });
          });
        });

        // 4. Navigation/Divider Animation
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

        // 5. SECTION SCROLL SNAPPING (Desktop Only): one stop per section
        ScrollTrigger.matchMedia({
          "(min-width: 1025px)": function () {
            const content = containerRef.current?.querySelector(".about-content") as HTMLElement | null;
            const scroller = content?.closest(".page-frame-content") as HTMLElement | null;
            if (!content || !scroller) return;
            const stages = Array.from(content.children) as HTMLElement[];
            const stops = () => {
              const max = Math.max(1, content.offsetHeight - scroller.clientHeight);
              return stages.map((s) => Math.min(1, s.offsetTop / max));
            };
            ScrollTrigger.create({
              trigger: ".about-content",
              start: "top top",
              end: "bottom bottom",
              snap: {
                snapTo: (value: number) =>
                  stops().reduce((best, stop) => (Math.abs(stop - value) < Math.abs(best - value) ? stop : best), 0),
                duration: { min: 0.4, max: 0.6 },
                delay: 0.1,
                ease: "power1.inOut"
              }
            });
          }
        });

        ScrollTrigger.refresh();

        // came by an old link to /philosophy
        if (section === "philosophy") {
          document.getElementById("philosophy")?.scrollIntoView({ block: "start" });
        }
      }, containerRef);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (ctx) ctx.revert();
    };
  }, [isLoaded, section]);

  const startWriting = () => {
    playButtonSound();
    if (guest) openGuide("write");
    else navigate("/person");
  };

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

          {/* STAGE 2: Philosophy */}
          <section className="about-section concept-section" id="philosophy">
            <div className="content-inner">
              <span className="section-kicker anim-up">философия</span>
              <h2 className="section-title anim-up">электрическое дерево</h2>
              <p className="section-lead anim-up">Пространство осознанного общения и личного языка</p>
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

          {/* STAGE 3: Rules — the numbers of «о проекте» and the principles of «философии»
              were the same three things; each card now holds both */}
          <section className="about-section rules-section">
            <h2 className="section-title anim-up">ограничения как свобода</h2>
            <div className="rules-grid">
              <article className="rule-card">
                <div className="rule-number">01</div>
                <div className="rule-label">пост в день</div>
                <div className="rule-title">Размеренность</div>
                <p className="rule-desc">Один пост в день — это ритм, который позволяет дышать.</p>
                <ul className="rule-laws">
                  <li>учит выбирать главное</li>
                </ul>
              </article>

              <article className="rule-card">
                <div className="rule-number">00</div>
                <div className="rule-label">редактирований</div>
                <div className="rule-title">Осознанность</div>
                <p className="rule-desc">Каждое слово — это ваш выбор. Качество важнее количества.</p>
                <ul className="rule-laws">
                  <li>без редактирования — учит ответственности</li>
                  <li>без удаления — создает честную историю</li>
                </ul>
              </article>

              <article className="rule-card">
                <div className="rule-number">∞</div>
                <div className="rule-label">слов в словаре</div>
                <div className="rule-title">Самопознание</div>
                <p className="rule-desc">Ваш словарик — это зеркало вашего внутреннего мира.</p>
                <ul className="rule-laws">
                  <li>каждый автор — автор языка</li>
                </ul>
              </article>
            </div>
          </section>

          {/* STAGE 4: The way */}
          <section className="about-section path-section">
            <div className="path-content">
              <div className="tree-divider-phi anim-up">
                <div className="divider-line-phi" />
                <div className="divider-text-phi">путь</div>
                <div className="divider-line-phi" />
              </div>
              <p className="final-quote anim-up">
                используйте вольтри-язык, и просто оставайтесь здесь столько,
                сколько пожелаете
              </p>
              <p className="final-sub anim-up">это не гонка. это путь.</p>
              <button className="path-cta anim-up" onClick={startWriting}>
                {guest ? "оставить первую запись" : "написать запись"}
              </button>
            </div>
          </section>

          {/* STAGE 5: Navigation */}
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

import React, { useEffect, useState, useRef } from "react";
import { GetNotices } from "../../requests/Api";
import { Notice } from "../../entity/Entity";
import { Loader } from "../../components/Loader/Loader";
import { GetPrettyTimePub } from "../../utils/DatetimeUtils";
import { PageFrame } from "../../components/PageFrame/PageFrame";
import { ScrollProgress } from "../../components/ScrollProgress/ScrollProgress";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./Notice.css";

gsap.registerPlugin(ScrollTrigger);

export const NoticePage: React.FC = () => {
    const [notices, setNotices] = useState<Notice[]>();
    const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>("");

    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchNotices = async () => {
            setIsLoading(true);
            setError("");
            try {
                const data = await GetNotices();
                setNotices(data);
            } catch (error) {
                console.error(error);
                setError("не удалось загрузить заметки.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchNotices();
    }, []);

    useEffect(() => {
        if (isLoading || !notices) return;
        let ctx: gsap.Context;

        const timer = setTimeout(() => {
            ctx = gsap.context(() => {
                // Hero Animation
                gsap.from(".notice-hero h1", {
                    y: 60,
                    opacity: 0,
                    duration: 1.5,
                    ease: "expo.out"
                });

                // Notices Staggered Reveal
                gsap.from(".notice-item", {
                    scrollTrigger: {
                        trigger: ".notices-wrapper",
                        start: "top 80%",
                    },
                    x: (i) => i % 2 === 0 ? -50 : 50,
                    opacity: 0,
                    stagger: 0.15,
                    duration: 1.2,
                    ease: "power3.out"
                });

                // Snapping
                ScrollTrigger.create({
                    trigger: ".notice-container",
                    start: "top top",
                    end: "bottom bottom",
                    snap: {
                        snapTo: [0, 0.5, 1],
                        duration: { min: 0.4, max: 0.6 },
                        delay: 0.1,
                        ease: "power1.inOut"
                    }
                });

                ScrollTrigger.refresh();
            }, containerRef);
        }, 100);

        return () => {
            clearTimeout(timer);
            if (ctx) ctx.revert();
        };
    }, [isLoading, notices]);

    if (isLoading) {
        return (
            <PageFrame>
                <div className="loading-container"><Loader /></div>
            </PageFrame>
        );
    }

    return (
        <PageFrame>
            <div className="notice" ref={containerRef}>
                <div className="notice-container">
                    {/* STAGE 1: Hero */}
                    <section className="notice-hero">
                        <h1>notes</h1>
                        <p>Статьи и работы, оформленные в виде ветвей знаний вольтри.</p>
                    </section>

                    {/* STAGE 2: Notices Tree-Style List */}
                    <section className="notice-list-section">
                        {error ? (
                            <div className="error-state">{error}</div>
                        ) : (
                            <div className="notices-wrapper">
                                {notices?.map((n: Notice, index: number) => (
                                    <div key={index} className="notice-item">
                                        <button
                                            className="notice-button"
                                            onClick={() => setSelectedNotice(n)}
                                        >
                                            <video
                                                className="notice-video-hover"
                                                src="/grok-video-7223f3a3-740c-4475-94e7-61fb94c7e026.mp4"
                                                autoPlay
                                                loop
                                                muted
                                                playsInline
                                            />
                                            <div className="notice-video-frame" />

                                            <span className="notice-title">{n.title}</span>
                                            <div className="notice-meta">
                                                <span>{n.author}</span>
                                                <span>{GetPrettyTimePub({ date: new Date(n.time_publication) })}</span>
                                            </div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* STAGE 3: Final Aesthetic Stop */}
                    <section className="notice-thank-you">
                        <h2>спасибо за чтение</h2>
                    </section>
                </div>
            </div>

            {/* Reading Mode Overlay */}
            {selectedNotice && (
                <div
                    className="reading-overlay"
                    ref={overlayRef}
                    onClick={() => setSelectedNotice(null)}
                    data-lenis-prevent
                >
                    {/* Themed Scroll Progress for the popup */}
                    <div className="reading-sidebar">
                        <ScrollProgress containerRef={overlayRef} mode="linear" />
                    </div>

                    <div className="reading-content" onClick={e => e.stopPropagation()}>
                        <header style={{ marginBottom: '4rem' }}>
                            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>{selectedNotice.title}</h1>
                            <div style={{ color: '#888', letterSpacing: '0.1em' }}>
                                {selectedNotice.author} — {GetPrettyTimePub({ date: new Date(selectedNotice.time_publication) })}
                            </div>
                        </header>
                        <div
                            className="article-body"
                            dangerouslySetInnerHTML={{ __html: selectedNotice.text_html }}
                        />
                        <div style={{ marginTop: '8rem', textAlign: 'center' }}>
                            <button
                                className="close-text-btn"
                                onClick={() => setSelectedNotice(null)}
                            >
                                вернуться к журналу / back
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageFrame>
    );
};

import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [notices, setNotices] = useState<Notice[]>();
    const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [copied, setCopied] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchNotices = async () => {
            setIsLoading(true);
            setError("");
            try {
                const data = await GetNotices();
                setNotices(data);
                if (id) {
                    const target = data.find((n: Notice) => n._id === id);
                    if (target) setSelectedNotice(target);
                }
            } catch (error) {
                console.error(error);
                setError("не удалось загрузить заметки.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchNotices();
    }, [id]);

    const openNotice = (n: Notice) => {
        setSelectedNotice(n);
        navigate(`/notes/${n._id}`, { replace: true });
    };

    const closeNotice = () => {
        setSelectedNotice(null);
        navigate("/notes", { replace: true });
    };

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.origin + `/notes/${selectedNotice?._id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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

                // Removed Snapping for dynamic length
                ScrollTrigger.refresh();

                ScrollTrigger.refresh();
            }, containerRef);
        }, 100);

        return () => {
            clearTimeout(timer);
            if (ctx) ctx.revert();
        };
    }, [isLoading, notices]);

    useEffect(() => {
        if (selectedNotice) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [selectedNotice]);

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
                                            onClick={() => openNotice(n)}
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

                </div>
            </div>

            {/* Reading Mode Overlay */}
            {selectedNotice && (
                <div
                    className="reading-overlay"
                    ref={overlayRef}
                    onClick={closeNotice}
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
                        <div style={{ marginTop: '8rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                            <button
                                className="close-text-btn"
                                onClick={copyLink}
                                style={{ opacity: 0.6, fontSize: '0.85rem', letterSpacing: '0.15em' }}
                            >
                                {copied ? "ссылка скопирована ✓" : "скопировать ссылку / share"}
                            </button>
                            <button
                                className="close-text-btn"
                                onClick={closeNotice}
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

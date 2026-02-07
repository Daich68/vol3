import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GetAuthorByID, GetPostsByAuthorID, GetDictByAuthorID, SaveDict } from "../../requests/Api";
import { Loader } from "../../components/Loader/Loader";
import { DictModal } from "./DictModal";
import "./Author.css";
import { Post, Dict, Author, DictEntry } from "../../entity/Entity";
import { WritePostModal } from "./WritePostModal";
import { GetPrettyTimePub } from "../../utils/DatetimeUtils";
import useSound from "use-sound";
// @ts-ignore
import buttonSound from "../../static/sound/button.wav";
import { DisplayGifWithMean } from "./Gifs";
import { safeLocalStorage } from "../../utils/localStorage";
import { PageFrame } from "../../components/PageFrame/PageFrame";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const AuthorPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [author, setAuthor] = useState<Author>();
    const [userID, setUserID] = useState<string>();
    const [posts, setPosts] = useState<Post[]>([]);
    const [isSelfPage, setIsSelfPage] = useState<boolean>(false);
    const [dict, setDict] = useState<Dict>();
    const [isDictModalOpen, setIsDictModalOpen] = useState(false);
    const [isWritePostModalOpen, setIsWritePostModalOpen] = useState(false);
    const [refreshPosts, setRefreshPosts] = useState(false);
    const [playB] = useSound(buttonSound, { volume: 2, loop: false });
    const [isDictLoaded, setIsDictLoaded] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const [canWrite, setCanWrite] = useState<boolean>(true);

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!id) {
            navigate("/not-found");
            return;
        }

        const fetchAuthorData = async () => {
            setIsLoading(true);
            setIsLoading(true);

            try {
                let currentUserID = safeLocalStorage.getItem("ID");
                if (currentUserID) {
                    setIsSelfPage(currentUserID === id);
                    setUserID(currentUserID);
                }

                const [authorData, dictData] = await Promise.all([
                    GetAuthorByID(id),
                    GetDictByAuthorID(id)
                ]);

                if (!authorData || authorData.length === 0) {
                    navigate("/not-found");
                    return;
                }

                setAuthor(authorData[0]);
                setDict(dictData[0] || undefined);
            } catch (error) {
                console.error(error);
                console.error(error);
            } finally {
                setIsDictLoaded(true);
                setIsLoading(false);
            }
        };

        fetchAuthorData();
    }, [id, navigate]);

    useEffect(() => {
        if (!id) return;

        const fetchPosts = async () => {
            try {
                const postsData = await GetPostsByAuthorID(id);
                setPosts(postsData);

                const today = new Date();
                const todayString = today.toLocaleDateString();
                const lastPostDate = postsData.length > 0
                    ? new Date(postsData[0].time_publication).toLocaleDateString()
                    : "";
                setCanWrite(lastPostDate !== todayString);
            } catch (error) {
                console.error(error);
            }
        };

        fetchPosts();
    }, [id, refreshPosts]);

    useEffect(() => {
        if (isLoading || !author) return;

        const timer = setTimeout(() => {
            const ctx = gsap.context(() => {
                // Name Hero Entry
                gsap.from(".author-name-hero", {
                    y: 100,
                    opacity: 0,
                    duration: 1.5,
                    ease: "expo.out"
                });

                gsap.from(".author-nav-item", {
                    y: 20,
                    opacity: 0,
                    stagger: 0.1,
                    duration: 1,
                    delay: 0.5,
                    ease: "power3.out",
                    clearProps: "all"
                });

                // Snap sections
                ScrollTrigger.create({
                    trigger: ".author-content-snap",
                    start: "top top",
                    end: "bottom bottom",
                    snap: {
                        snapTo: [0, 1],
                        duration: { min: 0.4, max: 0.6 },
                        delay: 0,
                        ease: "power1.inOut"
                    }
                });

                // Post reveal
                gsap.from(".post-card", {
                    scrollTrigger: {
                        trigger: ".author-posts-section",
                        start: "top 85%",
                    },
                    y: 50,
                    autoAlpha: 0,
                    stagger: 0.1,
                    duration: 1,
                    ease: "power2.out",
                    clearProps: "all"
                });

                ScrollTrigger.refresh();
            }, containerRef);
            return () => ctx.revert();
        }, 200); // Increased delay to ensure DOM is fully ready

        return () => clearTimeout(timer);
    }, [isLoading, author, posts.length]);

    const logout = () => {
        safeLocalStorage.clear();
        navigate("/login");
    };

    const onUpdateDict = async (d: DictEntry[]) => {
        if (!userID) return;
        const newDict: Dict = {
            _id: dict?._id,
            dict: d,
            author_id: userID,
        }

        try {
            await SaveDict(newDict);
            setDict(newDict);
            setRefreshPosts(prev => !prev);
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    if (isLoading || !author || !isDictLoaded) {
        return <PageFrame><Loader /></PageFrame>;
    }

    return (
        <PageFrame>
            <div className="author" ref={containerRef}>
                <div className="author-content-snap">
                    {/* STAGE 1: Hero */}
                    <section className="author-section author-hero">
                        <div className="header-details">
                            <div className="detail-top-bar">
                                <span className="detail-tag">PROFILE.ID_{author._id.slice(-4)}</span>
                                <span className="detail-line" />
                                <span className="detail-status">ACCESS_GRANTED</span>
                            </div>
                            <div className="corner-mark top-left" />
                            <div className="corner-mark top-right" />
                            <div className="corner-mark bottom-left" />
                            <div className="corner-mark bottom-right" />
                            <div className="side-label">AUTHOR_VAULT_VOL3</div>
                        </div>
                        <div className="author-hero-accent">{author.login.charAt(0)}</div>

                        <div className="author-hero-main">
                            <div className="author-meta-top">
                                <span className="meta-id">vol_{author._id.slice(-4)}</span>
                            </div>
                            <h1 className="author-name-hero">{author.login}</h1>

                            <div className="author-stats-premium">
                                <div className="stat-box">
                                    <span className="stat-value">{posts.length}</span>
                                    <span className="stat-label">артефактов</span>
                                </div>
                                <div className="stat-divider" />
                                <div className="stat-box">
                                    <span className="stat-value">{dict?.dict.length || 0}</span>
                                    <span className="stat-label">терминов</span>
                                </div>
                            </div>

                            <div className="author-nav-premium">
                                <button className="author-nav-item" onClick={() => { setIsDictModalOpen(true); playB(); }}>
                                    <span>словарь</span>
                                    <span className="nav-icon">📖</span>
                                </button>

                                {isSelfPage && (
                                    <>
                                        <button className="author-nav-item" onClick={() => { setIsWritePostModalOpen(true); playB(); }}>
                                            <span>написать</span>
                                            <span className="nav-icon">✍️</span>
                                        </button>
                                        <button className="author-nav-item logout" onClick={() => { playB(); logout(); }}>
                                            <span>выйти</span>
                                            <span className="nav-icon">🚪</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* STAGE 2: Posts */}
                    <section className="author-section author-posts-section">
                        <div className="author-posts-container">
                            <div className="posts-header-line">
                                <h2>Архив публикаций</h2>
                                <div className="line-accent" />
                            </div>

                            {posts.length === 0 ? (
                                <div className="author-empty-state">
                                    <p>{isSelfPage ? "здесь пока пусто. молчание — золото, но вольтри жаждет слов." : "автор предпочитает тишину."}</p>
                                </div>
                            ) : (
                                posts.map((post, index) => (
                                    <article key={post._id} className="post-card">
                                        <div className="post-archive-number">
                                            #{String(posts.length - index).padStart(3, '0')}
                                        </div>
                                        <div className="post-inner">
                                            <div className="post-content" dangerouslySetInnerHTML={{ __html: DisplayGifWithMean(post.text, dict?.dict || []) }} />
                                            <div className="post-footer">
                                                <time className="post-time" dateTime={new Date(post.time_publication).toISOString()}>
                                                    {GetPrettyTimePub({ date: new Date(post.time_publication) })}
                                                </time>
                                            </div>
                                        </div>
                                        <div className="post-card-border" />
                                    </article>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                <DictModal
                    isOpen={isDictModalOpen}
                    onClose={() => {
                        setIsDictModalOpen(false);
                        playB();
                    }}
                    dict={dict?.dict || []}
                    onUpdateDict={onUpdateDict}
                    editable={isSelfPage}
                />

                {userID && isSelfPage && (
                    <WritePostModal
                        isOpen={isWritePostModalOpen}
                        onClose={() => {
                            setIsWritePostModalOpen(false);
                            playB();
                        }}
                        userID={userID}
                        refreshPosts={() => {
                            setRefreshPosts((prev) => !prev);
                            playB();
                        }}
                        canWrite={canWrite}
                    />
                )}
            </div>
        </PageFrame>
    );
};

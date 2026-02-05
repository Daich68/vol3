import React, { useEffect, useState, useRef } from "react";
import { Author, Post } from "../../entity/Entity";
import "./Search.css";
import { GetAuthors, GetPosts } from "../../requests/Api";
import { Link } from "react-router-dom";
import { Loader } from "../../components/Loader/Loader";
import { GetPrettyTimePub } from "../../utils/DatetimeUtils";
import { useDebounce } from "../../hooks/useDebounce";
import { PageFrame } from "../../components/PageFrame/PageFrame";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const Search: React.FC = () => {
    const [authors, setAuthors] = useState<Author[]>();
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [filteredAuthors, setFilteredAuthors] = useState<Author[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>("");

    const containerRef = useRef<HTMLDivElement>(null);
    const debouncedSearchQuery = useDebounce(searchQuery, 100);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError("");

            try {
                const [authorsData, postsData] = await Promise.all([
                    GetAuthors(),
                    GetPosts()
                ]);

                setAuthors(authorsData);
                setFilteredAuthors(authorsData);
                setPosts(postsData);
            } catch (error) {
                console.error(error);
                setError("не удалось загрузить данные. попробуйте обновить страницу");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (!authors) return;

        const query = debouncedSearchQuery.toLowerCase().trim();

        if (!query) {
            setFilteredAuthors(authors);
            return;
        }

        const filtered = authors.filter((author) =>
            author.login.toLowerCase().includes(query)
        );
        setFilteredAuthors(filtered);
    }, [debouncedSearchQuery, authors]);

    useEffect(() => {
        if (isLoading) return;

        // Use a small delay to ensure DOM is ready for GSAP to find elements
        const timer = setTimeout(() => {
            const ctx = gsap.context(() => {
                // Intro Animations
                gsap.from(".search-hero-title", {
                    y: 60,
                    opacity: 0,
                    duration: 1.2,
                    ease: "expo.out"
                });

                gsap.from(".search-input-container", {
                    y: 40,
                    opacity: 0,
                    duration: 1,
                    delay: 0.2,
                    ease: "power3.out"
                });

                // Snap logic for the two sections
                ScrollTrigger.create({
                    trigger: ".search",
                    start: "top top",
                    end: "bottom bottom",
                    snap: {
                        snapTo: [0, 1],
                        duration: { min: 0.3, max: 0.5 },
                        delay: 0,
                        ease: "power1.inOut"
                    }
                });

                // Staggered reveal for author cards - only if not already visible/animating
                // We use autoAlpha to handle both opacity and visibility
                if (filteredAuthors.length > 0) {
                    gsap.from(".author-card", {
                        scrollTrigger: {
                            trigger: ".search-results",
                            start: "top 95%",
                        },
                        y: 30,
                        autoAlpha: 0, // Sets visibility: hidden and opacity: 0
                        stagger: 0.04,
                        duration: 0.8,
                        ease: "power2.out",
                        clearProps: "all"
                    });
                }

                ScrollTrigger.refresh();
            }, containerRef);

            return () => ctx.revert();
        }, 150);

        return () => clearTimeout(timer);
    }, [isLoading, filteredAuthors.length > 0]); // Only re-run when going from 0 to some authors

    const getMostRecentPost = (authorId: string) => {
        const authorPosts = posts.filter((post) => post.author_id === authorId);
        const sortedPosts = authorPosts.sort((a, b) => new Date(b.time_publication).getTime() - new Date(a.time_publication).getTime());
        return sortedPosts[0];
    };

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
    };

    const sortedAuthors = filteredAuthors.sort((a, b) => {
        const postA = getMostRecentPost(a._id);
        const postB = getMostRecentPost(b._id);

        if (!postA) return 1;
        if (!postB) return -1;

        return new Date(postB.time_publication).getTime() - new Date(postA.time_publication).getTime();
    });

    if (isLoading) {
        return <PageFrame><Loader /></PageFrame>;
    }

    return (
        <PageFrame>
            <div className="search" ref={containerRef}>
                <div className="search-content">
                    {/* STAGE 1: Hero & Input */}
                    <section className="search-section search-hero">
                        <h1 className="search-hero-title">search</h1>
                        <div className="search-input-container">
                            <input
                                id="search-input"
                                type="text"
                                className="search-input-premium"
                                placeholder="..."
                                value={searchQuery}
                                onChange={handleSearch}
                                autoComplete="off"
                                autoFocus
                            />
                            <div className="search-input-line" />
                            <label htmlFor="search-input" className="search-label">
                                {searchQuery ? "ищем по ключу" : "всплыви из глубины воспоминаний"}
                            </label>
                        </div>
                    </section>

                    {/* STAGE 2: Results */}
                    <section className="search-section search-results">
                        <div className="results-wrapper">
                            {error ? (
                                <div className="error-state" role="alert">{error}</div>
                            ) : sortedAuthors.length === 0 ? (
                                <div className="empty-state">
                                    <p>ничего не найдено</p>
                                </div>
                            ) : (
                                <div className="author-grid">
                                    {sortedAuthors.map((author: Author) => {
                                        const mostRecentPost = getMostRecentPost(author._id);
                                        let prettyTime = ""
                                        if (mostRecentPost) {
                                            prettyTime = GetPrettyTimePub({ date: new Date(mostRecentPost.time_publication) })
                                        }

                                        return (
                                            <Link
                                                to={`/author/${author._id}`}
                                                className="author-card"
                                                key={author._id}
                                            >
                                                <div className="author-card-content">
                                                    <span className="author-name">{author.login}</span>
                                                    {prettyTime && (
                                                        <span className="author-date">
                                                            {prettyTime}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="author-card-hover" />
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </PageFrame>
    );
};

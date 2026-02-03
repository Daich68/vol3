import React, { useEffect, useState } from "react";
import { Author, Post } from "../../entity/Entity";
import "./Search.css";
import { GetAuthors, GetPosts } from "../../requests/Api";
import { Link } from "react-router-dom";
import { Loader } from "../components/loader/Loader";
import { GetPrettyTimePub } from "../../utils/DatetimeUtils";
import { useDebounce } from "../../hooks/useDebounce";
import { ScrollProgress } from "../../components/ScrollProgress/ScrollProgress";

export const Search: React.FC = () => {
    const [authors, setAuthors] = useState<Author[]>();
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [filteredAuthors, setFilteredAuthors] = useState<Author[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>("");
    
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

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
        return <Loader />;
    }

    if (error) {
        return (
            <div className="search">
                <div className="error-state" role="alert">
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="search">
            <ScrollProgress />
            <div className={"input-container"}>
                <label htmlFor="search-input" className="visually-hidden">
                    поиск авторов
                </label>
                <input
                    id="search-input"
                    type="search"
                    className="search-input"
                    placeholder="если хочешь, найди кого-нибудь"
                    value={searchQuery}
                    onChange={handleSearch}
                    aria-label="поиск авторов"
                    autoComplete="off"
                />
            </div>
            
            {sortedAuthors.length === 0 ? (
                <div className="empty-state">
                    <p>
                        {searchQuery 
                            ? `ничего не найдено по запросу "${searchQuery}"` 
                            : "пока нет авторов"}
                    </p>
                </div>
            ) : (
                <div role="list" aria-label="список авторов">
                    {sortedAuthors.map((author: Author) => {
                        const mostRecentPost = getMostRecentPost(author._id);
                        let prettyTime = ""
                        if (mostRecentPost){
                            prettyTime = GetPrettyTimePub({ date: new Date(mostRecentPost.time_publication) })
                        }

                        return (
                            <div className="author" key={author._id} role="listitem">
                                <Link to={`/author/${author._id}`}>{author.login}</Link>
                                {prettyTime && <div className="time-publication"> {`последний пост ${prettyTime}`} </div>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

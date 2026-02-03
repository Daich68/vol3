import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {GetAuthorByID, GetPostsByAuthorID, GetDictByAuthorID, SaveDict} from "../../requests/Api";
import { Loader } from "../components/loader/Loader";
import { DictModal } from "./DictModal";
import "./Author.css";
import {Post, Dict, Author, DictEntry} from "../../entity/Entity";
import { WritePostModal } from "./WritePostModal";
import { GetPrettyTimePub } from "../../utils/DatetimeUtils";
import useSound from "use-sound";
// @ts-ignore
import button from "../../static/sound/button.wav";
import {DisplayGifWithMean} from "./Gifs";
import { safeLocalStorage } from "../../utils/localStorage";
import { ScrollProgress } from "../../components/ScrollProgress/ScrollProgress";

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
    const [playB] = useSound(button, { volume: 2, loop: false });
    const [isDictLoaded, setIsDictLoaded] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [canWrite, setCanWrite] = useState<boolean>(true);

    useEffect(() => {
        if (!id) {
            navigate("/not-found");
            return;
        }

        const fetchAuthorData = async () => {
            setIsLoading(true);
            setError("");
            
            try {
                let userID = safeLocalStorage.getItem("ID");
                if (userID) {
                    setIsSelfPage(userID === id);
                    setUserID(userID);
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
                setError("не удалось загрузить данные автора");
            } finally {
                setIsDictLoaded(true);
                setIsLoading(false);
            }
        };

        fetchAuthorData();
    }, [id, navigate]);

    useEffect(() => {
        if (!id) {
            navigate("/not-found");
            return;
        }

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
    }, [id, navigate, refreshPosts]);

    const logout = () => {
        safeLocalStorage.clear();
        navigate("/login");
    };

    const onUpdateDict = async (d: DictEntry[]) => {
        if (!userID){
            console.error("no userID!")
            return
        }
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

    if (isLoading) {
        return <Loader />;
    }

    if (error) {
        return (
            <div className="author">
                <div className="error-state" role="alert">
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!author || !isDictLoaded) {
        return <Loader />;
    }

    return (
        <div className="author">
            <ScrollProgress />
            <div className="header">
                <div className="actions">
                    <button 
                        onClick={() => {
                            setIsDictModalOpen(true);
                            playB();
                        }}
                        aria-label="открыть словарик"
                        title="словарик"
                    >
                        📖
                    </button>
                    {isSelfPage && (
                        <button 
                            onClick={() => {
                                setIsWritePostModalOpen(true);
                                playB();
                            }}
                            aria-label="написать пост"
                            title="написать пост"
                        >
                            ✍️
                        </button>
                    )}
                    {isSelfPage && (
                        <button 
                            onClick={() => {
                                playB();
                                logout();
                            }}
                            aria-label="выйти"
                            title="выйти"
                        >
                            🚪️
                        </button>
                    )}
                </div>
                <h1 className="name">{author.login}</h1>
            </div>
            <hr/>

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

            <div className="posts" role="feed" aria-label="посты автора">
                {posts.length === 0 ? (
                    <div className="empty-state">
                        <p>{isSelfPage ? "у тебя пока нет постов. напиши первый!" : "у автора пока нет постов"}</p>
                    </div>
                ) : (
                    posts.map((post) => (
                        <article key={post._id} className="post">
                            <div dangerouslySetInnerHTML={{ __html: DisplayGifWithMean(post.text, dict?.dict || []) }} />
                            <div className="time-publication">
                                <time dateTime={new Date(post.time_publication).toISOString()}>
                                    {GetPrettyTimePub({ date: new Date(post.time_publication) })}
                                </time>
                            </div>
                        </article>
                    ))
                )}
            </div>
        </div>
    );
};

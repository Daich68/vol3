import React, { useState, useEffect, useRef } from "react";
import "./WritePostModal.css";
import { Post } from "../../entity/Entity";
import { SendPost } from "../../requests/Api";
import { DisplayGif, Gifs } from "./Gifs";
import { useKeyPress } from "../../hooks/useKeyPress";
import { useFocusTrap } from "../../hooks/useFocusTrap";

export const WritePostModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    userID: string;
    refreshPosts: () => void;
    canWrite: boolean;
}> = ({ isOpen, onClose, userID, refreshPosts, canWrite }) => {
    const [postText, setPostText] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [timer, setTimer] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const MAX_LENGTH = 10000;

    useFocusTrap(modalRef, isOpen);
    useKeyPress('Escape', () => {
        if (isOpen && !isSubmitting) {
            onClose();
        }
    });

    // Function to calculate time difference to the next day
    const calculateTimeToNextDay = () => {
        const now = new Date();
        const nextDay = new Date(now);
        nextDay.setHours(24, 0, 0, 0);
        return nextDay.getTime() - now.getTime();
    };

    // Start a timer to update the countdown
    useEffect(() => {
        if (!canWrite) {
            const updateTimer = () => {
                setTimer(calculateTimeToNextDay());
            };

            updateTimer();
            const interval = setInterval(updateTimer, 60000); // Update every minute

            return () => clearInterval(interval);
        }
    }, [canWrite]);

    // Function to format time left as hh:mm:ss
    const formatTime = (ms: number) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}ч ${minutes}м`;
    };

    const handleAddGif = (tag: string) => {
        let newText = `${postText} ${tag}`;
        if (newText.length <= MAX_LENGTH) {
            setPostText(newText);
            setErrorMessage("");
        } else {
            setErrorMessage(`превышена максимальная длина поста`);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        if (newText.length <= MAX_LENGTH) {
            setPostText(newText);
            setErrorMessage("");
        } else {
            setErrorMessage(`превышена максимальная длина поста`);
        }
    };

    const handlePost = async () => {
        if (postText.length > 0 && postText.length <= MAX_LENGTH && !isSubmitting) {
            setIsSubmitting(true);
            setErrorMessage("");

            const newPost: Post = {
                time_publication: new Date(Date.now()),
                text: postText,
                author_id: userID,
            };

            try {
                await SendPost(newPost);
                setPostText("");
                refreshPosts();
                onClose();
            } catch (error) {
                console.error(error);
                setErrorMessage("не удалось опубликовать пост. попробуйте еще раз");
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            onClose();
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !isSubmitting) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className={`dict-modal-overlay ${isOpen ? 'open' : ''}`}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className="dict-modal-content" ref={modalRef}>
                <div className="dict-modal-inner">
                    <div className="dict-modal-header">
                        <div className="dict-modal-header-text">
                            <span className="dict-modal-subtitle">Создание записи</span>
                            <h2 id="modal-title">Новый пост</h2>
                        </div>
                        <button
                            className="dict-close-btn"
                            onClick={handleClose}
                            aria-label="закрыть"
                            disabled={isSubmitting}
                        >
                            &times;
                        </button>
                    </div>

                    <div className="dict-scroll-area" data-lenis-prevent>
                        {canWrite ? (
                            <div className="write-post-form">
                                {/* GIF Picker */}
                                <div className="gif-selection-label">Выберите символ (опционально)</div>
                                <div className="gif-picker" role="toolbar" aria-label="выбор гифок">
                                    {Gifs.map((gif) => (
                                        <button
                                            key={gif.tag}
                                            onClick={() => handleAddGif(gif.tag)}
                                            className="gif-item"
                                            type="button"
                                            aria-label={`добавить ${gif.alt}`}
                                            disabled={isSubmitting}
                                        >
                                            <div className="gif-thumbnail-wrapper">
                                                <img src={gif.src} alt={gif.alt} className="gif-thumbnail" />
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="write-post-input-group">
                                    <label htmlFor="post-textarea" className="dict-item-tag">
                                        текст поста
                                    </label>
                                    <textarea
                                        id="post-textarea"
                                        className="dict-textarea write-textarea"
                                        value={postText}
                                        onChange={handleInputChange}
                                        placeholder="напиши что-то, не торопись..."
                                        disabled={isSubmitting}
                                        aria-describedby={errorMessage ? "post-error" : undefined}
                                        aria-invalid={!!errorMessage}
                                        rows={3}
                                    />
                                </div>

                                {errorMessage && (
                                    <div id="post-error" className="error-message" role="alert">
                                        {errorMessage}
                                    </div>
                                )}

                                <div className="preview-label dict-item-tag">предпросмотр</div>
                                <div
                                    className="post-preview-container"
                                    dangerouslySetInnerHTML={{
                                        __html: DisplayGif(postText),
                                    }}
                                    aria-label="предпросмотр поста"
                                />
                            </div>
                        ) : (
                            <div className="cooldown-state">
                                <p className="cooldown-message">Сегодня вы уже внесли свой вклад в дерево.</p>
                                <p className="cooldown-sub">Возможность следующей публикации появится через:</p>
                                <div className="cooldown-timer">{formatTime(timer)}</div>
                            </div>
                        )}
                    </div>

                    <div className="dict-modal-footer">
                        {canWrite ? (
                            <>
                                <span className="dict-footer-meta">энергия кристаллизации слов</span>
                                <button
                                    className="dict-save-btn"
                                    onClick={handlePost}
                                    disabled={postText.length === 0 || postText.length > MAX_LENGTH || isSubmitting}
                                    aria-busy={isSubmitting}
                                >
                                    {isSubmitting ? "публикация..." : "опубликовать"}
                                </button>
                            </>
                        ) : (
                            <span className="dict-footer-meta">режим накопления мыслей</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

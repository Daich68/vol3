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
            className="modal" 
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className="modal-content" ref={modalRef}>
                <button 
                    className="close" 
                    onClick={handleClose}
                    aria-label="закрыть"
                    disabled={isSubmitting}
                >
                    &times;
                </button>
                <h2 id="modal-title">новый пост</h2>

                {canWrite ? (
                    <div>
                        {/* GIF Picker */}
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
                                    <img src={gif.src} alt={gif.alt} className="gif-thumbnail" />
                                </button>
                            ))}
                        </div>

                        {/* Textarea for writing the post */}
                        <label htmlFor="post-textarea" className="visually-hidden">
                            текст поста
                        </label>
                        <textarea
                            id="post-textarea"
                            value={postText}
                            onChange={handleInputChange}
                            placeholder="напиши что-то, не торопись"
                            disabled={isSubmitting}
                            aria-describedby={errorMessage ? "post-error" : undefined}
                            aria-invalid={!!errorMessage}
                        ></textarea>

                        {/* Display error message if character limit is exceeded */}
                        {errorMessage && (
                            <div id="post-error" className="error-message" role="alert">
                                {errorMessage}
                            </div>
                        )}

                        {/* Preview of post content */}
                        <div
                            className="post-preview"
                            dangerouslySetInnerHTML={{
                                __html: DisplayGif(postText),
                            }}
                            aria-label="предпросмотр поста"
                        ></div>

                        {/* Post button */}
                        <button
                            onClick={handlePost}
                            disabled={postText.length === 0 || postText.length > MAX_LENGTH || isSubmitting}
                            aria-busy={isSubmitting}
                        >
                            {isSubmitting ? "публикация..." : "опубликовать"}
                        </button>
                    </div>
                ) : (
                    <div>
                        <p>сегодня ты уже сделал пост</p>
                        <p>в следующий раз сможешь опубликовать через:</p>
                        <p><strong>{formatTime(timer)}</strong></p>
                    </div>
                )}
            </div>
        </div>
    );
};

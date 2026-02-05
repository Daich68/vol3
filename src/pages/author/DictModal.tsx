import React, { useState, useRef, useEffect } from "react";
import { Gifs } from "./Gifs";
import { DictEntry } from "../../entity/Entity";
import "./DictModal.css"
import { useKeyPress } from "../../hooks/useKeyPress";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface DictModalProps {
    isOpen: boolean;
    onClose: () => void;
    dict: DictEntry[];
    onUpdateDict: (updatedDict: DictEntry[]) => void;
    editable: boolean;
}

export const DictModal: React.FC<DictModalProps> = ({ isOpen, onClose, dict, onUpdateDict, editable }) => {
    const [localDict, setLocalDict] = useState(dict || []);
    const [isSaving, setIsSaving] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    // Sync local state when dict prop changes
    useEffect(() => {
        setLocalDict(dict || []);
    }, [dict]);

    useFocusTrap(modalRef, isOpen);
    useKeyPress('Escape', () => {
        if (isOpen && !isSaving) {
            onClose();
        }
    });

    const handleChange = (gifTag: string, value: string) => {
        setLocalDict(prev => {
            const index = prev.findIndex(item => item.gif_tag === gifTag);
            if (index > -1) {
                const updated = [...prev];
                updated[index] = { ...updated[index], meaning: value };
                return updated;
            } else {
                return [...prev, { gif_tag: gifTag, meaning: value }];
            }
        });
    };

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await onUpdateDict(localDict);
            onClose();
        } catch (error) {
            console.error("Failed to save dict:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !isSaving) {
            onClose();
        }
    };

    return (
        <div
            className={`dict-modal-overlay ${isOpen ? 'open' : ''}`}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
        >
            <div className="dict-modal-content" ref={modalRef}>
                <div className="dict-modal-inner">
                    <div className="dict-modal-header">
                        <div className="dict-modal-header-text">
                            <span className="dict-modal-subtitle">Архив терминов</span>
                            <h2>Синтаксис мира</h2>
                        </div>
                        <button
                            className="dict-close-btn"
                            onClick={onClose}
                            aria-label="закрыть"
                            disabled={isSaving}
                        >
                            &times;
                        </button>
                    </div>

                    <div className="dict-scroll-area" data-lenis-prevent>
                        <ul className="dict-list">
                            {Gifs.map((gif) => {
                                const entry = localDict.find((entry) => entry.gif_tag === gif.tag);
                                return (
                                    <li key={gif.tag} className="dict-premium-item">
                                        <div className="dict-item-visual-wrapper">
                                            <div className="dict-item-visual">
                                                <img src={gif.src} alt={gif.alt} />
                                            </div>
                                            <div className="dict-visual-shadow" />
                                        </div>
                                        <div className="dict-item-info">
                                            <span className="dict-item-tag">index_{gif.tag}</span>
                                            {editable ? (
                                                <textarea
                                                    className="dict-textarea"
                                                    value={entry ? entry.meaning : ""}
                                                    onChange={(e) => handleChange(gif.tag, e.target.value)}
                                                    placeholder="определите это чувство..."
                                                    disabled={isSaving}
                                                    rows={1}
                                                />
                                            ) : (
                                                <p className="dict-meaning-readonly">
                                                    {entry?.meaning || "этот символ пока хранит молчание"}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {editable ? (
                        <div className="dict-modal-footer">
                            <span className="dict-footer-meta">внесение правок в синтаксис</span>
                            <button
                                className="dict-save-btn"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? "кристаллизация..." : "закрепить"}
                            </button>
                        </div>
                    ) : (
                        <div className="dict-modal-footer">
                            <span className="dict-footer-meta">только чтение архива</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

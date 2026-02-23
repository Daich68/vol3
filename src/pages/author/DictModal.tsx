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
    const [tooltip, setTooltip] = useState<{ x: number, y: number, meaning: string, tag: string } | null>(null);
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

    const handleMouseMove = (e: React.MouseEvent) => {
        if (tooltip) {
            setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
        }
    };

    const handleMouseEnter = (e: React.MouseEvent, tag: string, meaning: string) => {
        setTooltip({ x: e.clientX, y: e.clientY, tag, meaning });
    };

    const handleMouseLeave = () => {
        setTooltip(null);
    };

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
            onMouseMove={handleMouseMove}
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
                                const currentMeaning = entry?.meaning || "этот символ пока хранит молчание";
                                return (
                                    <li key={gif.tag} className="dict-premium-item">
                                        <div
                                            className="dict-item-visual-wrapper"
                                            onMouseEnter={(e) => handleMouseEnter(e, gif.tag, currentMeaning)}
                                            onMouseLeave={handleMouseLeave}
                                        >
                                            <div className="dict-item-visual">
                                                <img src={gif.src} alt={gif.alt} />
                                                <div className="dict-visual-glitch" />
                                            </div>
                                            <div className="dict-visual-shadow" />
                                        </div>
                                        <div className="dict-item-info">
                                            <div className="dict-syntax-group">
                                                <span className="dict-syntax-label">LEXEME</span>
                                                <span className="dict-item-tag">{gif.tag}</span>
                                            </div>

                                            <div className="dict-syntax-group">
                                                <span className="dict-syntax-label">VALUE</span>
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
                                                        {currentMeaning}
                                                    </p>
                                                )}
                                            </div>
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

            {tooltip && (
                <div
                    className="dict-cursor-tooltip"
                    style={{
                        left: `${tooltip.x + 20}px`,
                        top: `${tooltip.y + 20}px`
                    }}
                >
                    <div className="tooltip-header">
                        <span className="tooltip-tag">{tooltip.tag}</span>
                        <div className="tooltip-line" />
                    </div>
                    <p className="tooltip-meaning">{tooltip.meaning}</p>
                    <div className="tooltip-footer">DATA_RECALL_VOL3</div>
                </div>
            )}
        </div>
    );
};

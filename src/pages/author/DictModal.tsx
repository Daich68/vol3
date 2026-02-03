import React, { useState, useRef } from "react";
import { Gifs } from "./Gifs";
import { DictEntry } from "../../entity/Entity";
import "./WritePostModal.css"
import { useKeyPress } from "../../hooks/useKeyPress";
import { useFocusTrap } from "../../hooks/useFocusTrap";

export const DictModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    dict: DictEntry[];
    onUpdateDict: (updatedDict: DictEntry[]) => void;
    editable: boolean;
}> = ({ isOpen, onClose, dict, onUpdateDict, editable }) => {
    const [localDict, setLocalDict] = useState(dict || []);
    const [isSaving, setIsSaving] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    useFocusTrap(modalRef, isOpen);
    useKeyPress('Escape', () => {
        if (isOpen && !isSaving) {
            onClose();
        }
    });

    const handleChange = (index: number, value: string) => {
        const updatedDict = [...localDict];
        updatedDict[index].meaning = value;
        setLocalDict(updatedDict);
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

    const handleClose = () => {
        if (!isSaving) {
            onClose();
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !isSaving) {
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
            aria-labelledby="dict-modal-title"
        >
            <div className="modal-content" ref={modalRef}>
                <button
                    className="close"
                    onClick={handleClose}
                    aria-label="закрыть"
                    disabled={isSaving}
                >
                    &times;
                </button>
                <h2 id="dict-modal-title">словарик-вольтри</h2>
                <ul>
                    {Gifs.map((gif) => {
                        const entry = localDict.find((entry) => entry.gif_tag === gif.tag);

                        return (
                            <li key={gif.tag} className="dict-item">
                                <img src={gif.src} alt={gif.alt} className="gif-thumbnail" />
                                <div className={"separator"}></div>
                                {editable ? (
                                    <>
                                        <label htmlFor={`dict-${gif.tag}`} className="visually-hidden">
                                            значение для {gif.alt}
                                        </label>
                                        <textarea
                                            id={`dict-${gif.tag}`}
                                            value={entry ? entry.meaning : ""}
                                            onChange={(e) => {
                                                if (entry) {
                                                    handleChange(
                                                        localDict.indexOf(entry),
                                                        e.target.value
                                                    );
                                                } else {
                                                    setLocalDict([
                                                        ...localDict,
                                                        { gif_tag: gif.tag, meaning: e.target.value },
                                                    ]);
                                                }
                                            }}
                                            placeholder="введите значение"
                                            disabled={isSaving}
                                        />
                                    </>
                                ) : (
                                    <p>{entry?.meaning || "пока не заполнено"}</p>
                                )}
                            </li>
                        );
                    })}
                </ul>
                {editable && (
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        aria-busy={isSaving}
                    >
                        {isSaving ? "сохранение..." : "сохранить"}
                    </button>
                )}
            </div>
        </div>
    );
};

import React, { useEffect, useState } from "react";
import { Glyph } from "../Glyph/Glyph";
import { DictEntry } from "../../entity/Entity";
import { useOnboarding } from "../Onboarding/OnboardingContext";
import { CHARACTERS, COLLECTIBLE, CompanionRecord, canSpinToday, deadline, isAlive, nextMidnight, readRecord } from "./companions";
import { Countdown } from "./Countdown";
import "./Companions.css";

interface CompanionShelfProps {
    authorId: string;
    dict: DictEntry[];
    isSelf: boolean;
}

// The author's companions on the profile — dark plates among the white page, the premium mark
// every visitor sees. The owner also sees the clocks: the streak, when they leave, when the wheel turns.
export const CompanionShelf: React.FC<CompanionShelfProps> = ({ authorId, dict, isSelf }) => {
    const { openWheel } = useOnboarding();
    const [record, setRecord] = useState<CompanionRecord | null>(() => readRecord(dict));

    useEffect(() => {
        setRecord(readRecord(dict));
    }, [dict]);

    // the cat updates the record while the page is open (a spin, the first companion)
    useEffect(() => {
        const onChange = (e: Event) => {
            const detail = (e as CustomEvent<{ authorId: string; record: CompanionRecord }>).detail;
            if (detail.authorId === authorId) setRecord(detail.record);
        };
        window.addEventListener("voltri:companions", onChange);
        return () => window.removeEventListener("voltri:companions", onChange);
    }, [authorId]);

    const alive = !!record && isAlive(record);
    const list = alive && record ? record.c : [];
    if (!record || (!isSelf && list.length === 0)) return null;

    return (
        <div className="companion-shelf">
            <div className="companion-head">
                <span>компаньоны</span>
                <span className="companion-line" />
                <span className="companion-count">{list.length}/{COLLECTIBLE.length}</span>
            </div>

            <div className="companion-row">
                {list.map((key, i) => (
                    <div
                        className="companion-tile"
                        key={key}
                        data-key={key}
                        title={`${CHARACTERS[key].name} — ${CHARACTERS[key].trait}`}
                        style={{ "--i": i } as React.CSSProperties}
                    >
                        <Glyph name={key} phase={i * 6} rate={0.8} className="companion-glyph" />
                        <span className="companion-name">{CHARACTERS[key].name}</span>
                    </div>
                ))}
                {isSelf && list.length === 0 && <span className="companion-empty">ушли. колесо вернёт</span>}
            </div>

            {isSelf && (
                <div className="companion-meta">
                    <span>серия {record.s} дн.</span>
                    {list.length > 0 && (
                        <span className="companion-danger">
                            уйдут через <Countdown to={deadline(record)} />
                        </span>
                    )}
                    {canSpinToday(record) ? (
                        <button className="companion-spin" onClick={openWheel}>колесо ждёт →</button>
                    ) : (
                        <span>
                            колесо через <Countdown to={nextMidnight()} />
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

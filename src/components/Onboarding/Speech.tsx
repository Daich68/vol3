import React, { useEffect, useMemo, useRef, useState } from "react";

interface SpeechProps {
    text: string;
    /** typing starts when the window has opened */
    active: boolean;
    /** reduced motion: the line is there at once */
    instant?: boolean;
    onSpeaking?: (speaking: boolean) => void;
    id?: string;
}

const CPS = 38;
// deterministic ±6 ms so the line does not tick like a metronome
const jitter = (i: number) => ((i * 7919) % 13) - 6;

// The cat's line, typed. Every character already takes its place (invisible), so the window
// knows its final height before the first letter appears and nothing jumps while she talks.
// A click finishes the line at once.
export const Speech: React.FC<SpeechProps> = ({ text, active, instant = false, onSpeaking, id }) => {
    const chars = useMemo(() => Array.from(text), [text]);
    const [shown, setShown] = useState(instant ? chars.length : 0);
    const timer = useRef<number>();
    const onSpeakingRef = useRef(onSpeaking);
    onSpeakingRef.current = onSpeaking;

    useEffect(() => {
        if (!active) return;
        if (instant) {
            setShown(chars.length);
            return;
        }
        let i = 0;
        setShown(0);
        onSpeakingRef.current?.(true);
        const step = () => {
            i += 1;
            setShown(i);
            if (i >= chars.length) {
                onSpeakingRef.current?.(false);
                return;
            }
            const c = chars[i - 1];
            const pause = /[.!?…]/.test(c) ? 280 : /[,—:;]/.test(c) ? 120 : 0;
            timer.current = window.setTimeout(step, 1000 / CPS + pause + jitter(i));
        };
        timer.current = window.setTimeout(step, 140);
        return () => {
            window.clearTimeout(timer.current);
            onSpeakingRef.current?.(false);
        };
    }, [active, chars, instant]);

    const finish = () => {
        if (shown >= chars.length) return;
        window.clearTimeout(timer.current);
        setShown(chars.length);
        onSpeakingRef.current?.(false);
    };

    // words are unbreakable boxes of letters, spaces stay plain text — lines wrap only between words
    let index = 0;
    const tokens = text.split(/(\s+)/).filter(Boolean);

    return (
        <p className="guide-speech" id={id} onClick={finish} aria-live="polite">
            <span className="guide-sr">{text}</span>
            <span aria-hidden="true">
                {tokens.map((token, t) => {
                    if (/^\s+$/.test(token)) {
                        index += Array.from(token).length;
                        return token;
                    }
                    return (
                        <span className="guide-speech-word" key={t}>
                            {Array.from(token).map((c) => {
                                const i = index++;
                                return (
                                    <span key={i} className={i < shown ? "is-on" : undefined}>
                                        {c}
                                    </span>
                                );
                            })}
                        </span>
                    );
                })}
            </span>
        </p>
    );
};

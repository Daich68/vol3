import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { Glyph } from "../Glyph/Glyph";
import { GlyphKey } from "../Glyph/glyphs";

interface DecodedProps {
    text: string;
    glyph: GlyphKey;
    /** seconds after `active` turns true */
    at: number;
    active: boolean;
    instant: boolean;
}

// The preloader's decoding in small: a boiling sign gives way to what it meant,
// with the same strokes — the sign falls apart in 0.25 s, the text rises in 0.4 s.
export const Decoded: React.FC<DecodedProps> = ({ text, glyph, at, active, instant }) => {
    const textRef = useRef<HTMLSpanElement>(null);
    const glyphRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const t = textRef.current;
        const g = glyphRef.current;
        if (!t || !g) return;
        if (instant) {
            gsap.set(t, { opacity: 1, y: 0 });
            gsap.set(g, { opacity: 0 });
            return;
        }
        gsap.set(t, { opacity: 0, y: "0.12em" });
        gsap.set(g, { opacity: 1, scale: 1 });
        if (!active) return;
        const tl = gsap.timeline({ delay: at })
            .to(g, { opacity: 0, scale: 0.8, duration: 0.25, ease: "power2.in" })
            .to(t, { opacity: 1, y: 0, duration: 0.4, ease: "expo.out" }, 0.12);
        return () => {
            tl.kill();
        };
    }, [active, instant, at]);

    return (
        <span className="guide-decoded">
            <span ref={textRef} className="guide-decoded-text">{text}</span>
            <Glyph ref={glyphRef} name={glyph} phase={Math.round(at * 40)} className="guide-decoded-glyph" />
        </span>
    );
};

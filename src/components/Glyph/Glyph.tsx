import React, { forwardRef, useEffect, useRef } from "react";
import gsap from "gsap";
import { GLYPHS, GlyphKey, glyphFrame } from "./glyphs";
import "./Glyph.css";

interface GlyphProps {
    name: GlyphKey;
    /** frame offset in 60 fps ticks, so neighbouring signs boil out of phase */
    phase?: number;
    /** boil rate multiplier; a ref lets a caller change it every frame without re-rendering */
    rate?: number | React.MutableRefObject<number>;
    className?: string;
    style?: React.CSSProperties;
}

// One sign from the dictionary, boiling on the shared GSAP clock.
// The rate is eased, not jumped: when the cat starts talking its line speeds up smoothly.
export const Glyph = forwardRef<HTMLSpanElement, GlyphProps>(
    ({ name, phase = 0, rate = 1, className = "", style }, forwardedRef) => {
        const localRef = useRef<HTMLSpanElement | null>(null);
        const rateRef = useRef(rate);
        rateRef.current = rate;

        useEffect(() => {
            const el = localRef.current;
            if (!el) return;
            const frames = GLYPHS[name].hold.length;
            const readRate = () => {
                const r = rateRef.current;
                return typeof r === "number" ? r : r.current;
            };
            let t = 0;
            let current = readRate();
            let shown = -1;

            const tick = (_time: number, deltaTime: number) => {
                const dt = Math.min(deltaTime, 100) / 1000;
                current += (readRate() - current) * (1 - Math.exp(-dt * 10));
                t += dt * current;
                const i = glyphFrame(name, t, phase);
                if (i !== shown) {
                    shown = i;
                    el.style.backgroundPosition = `${frames > 1 ? (i / (frames - 1)) * 100 : 0}% 0`;
                }
            };

            tick(0, 0);
            gsap.ticker.add(tick);
            return () => gsap.ticker.remove(tick);
        }, [name, phase]);

        const setRefs = (el: HTMLSpanElement | null) => {
            localRef.current = el;
            if (typeof forwardedRef === "function") forwardedRef(el);
            else if (forwardedRef) forwardedRef.current = el;
        };

        return (
            <span
                ref={setRefs}
                className={`glyph ${className}`}
                style={{
                    backgroundImage: `url(${GLYPHS[name].src})`,
                    backgroundSize: `${GLYPHS[name].hold.length * 100}% 100%`,
                    ...style,
                }}
                aria-hidden="true"
            />
        );
    }
);

Glyph.displayName = "Glyph";

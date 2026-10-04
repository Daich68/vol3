import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Glyph } from "../Glyph/Glyph";
import { GLYPH_ORDER, GlyphKey } from "../Glyph/glyphs";
import { SOFT_SPRING } from "./catMotion";

interface SignReelProps {
    sign: GlyphKey | null;
    /** bump to spin again (a long spin for the first issue, a short one for a manual pick) */
    spinKey: number;
    long: boolean;
    reduce: boolean;
    onLand?: (sign: GlyphKey) => void;
}

const N = GLYPH_ORDER.length;

// «символ выдало»: the twelve signs on a reel with no beginning and no end. It is thrown
// and comes to rest by exponential decay on the sign the note produced — no bounce, the
// product's physics does not overshoot. Speed is drawn as stretch and blur along the motion.
export const SignReel: React.FC<SignReelProps> = ({ sign, spinKey, long, reduce, onLand }) => {
    const windowRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
    // starts a few cells away from the answer, so the reel never shows it before the throw
    const offset = useRef(sign ? GLYPH_ORDER.indexOf(sign) + 5 : 0);
    const onLandRef = useRef(onLand);
    onLandRef.current = onLand;

    const layout = useCallback((velocity = 0) => {
        const cell = windowRef.current?.clientHeight || 120;
        const speed = Math.abs(velocity);
        cellRefs.current.forEach((el, j) => {
            if (!el) return;
            let d = j - offset.current;
            d = ((d % N) + N) % N;
            if (d >= N / 2) d -= N;
            const visible = Math.abs(d) < 1.5;
            el.style.visibility = visible ? "visible" : "hidden";
            if (!visible) return;
            const stretch = 1 + Math.min(0.6, speed * 0.5);
            el.style.transform = `translate3d(0, ${d * cell}px, 0) scaleY(${stretch})`;
            el.style.opacity = String(Math.max(0, 1 - Math.abs(d) * 0.85));
            el.style.filter = speed > 0.05 ? `blur(${Math.min(3, speed * 2.2).toFixed(2)}px)` : "";
        });
    }, []);

    useLayoutEffect(() => {
        layout();
    }, [layout]);

    useEffect(() => {
        if (!sign) return;
        const target = GLYPH_ORDER.indexOf(sign);
        const from = offset.current;
        const at = ((from % N) + N) % N;
        let delta = target - at;
        if (delta < 0) delta += N;
        if (long) delta += 2 * N;
        if (delta === 0) return;

        const land = () => {
            offset.current = from + delta;
            layout(0);
            if (frameRef.current) {
                gsap.fromTo(frameRef.current, { scale: 1.07 }, { scale: 1, duration: 0.7, ease: SOFT_SPRING });
            }
            onLandRef.current?.(sign);
        };

        if (reduce) {
            land();
            return;
        }

        const proxy = { v: from };
        let last = from;
        const tween = gsap.to(proxy, {
            v: from + delta,
            duration: long ? 1.9 : 0.8,
            delay: long ? 0.35 : 0,
            ease: long ? "power4.out" : "expo.out",
            onUpdate: () => {
                const velocity = proxy.v - last; // cells per frame
                last = proxy.v;
                offset.current = proxy.v;
                layout(velocity);
            },
            onComplete: land,
        });
        return () => {
            tween.kill();
        };
    }, [spinKey, sign, long, reduce, layout]);

    return (
        <div className={`guide-reel ${sign ? "" : "is-empty"}`} ref={frameRef}>
            <div className="guide-reel-window" ref={windowRef}>
                {GLYPH_ORDER.map((key, j) => (
                    <div className="guide-reel-cell" key={key} ref={(el) => { cellRefs.current[j] = el; }}>
                        <Glyph name={key} phase={j * 5} className="guide-reel-glyph" />
                    </div>
                ))}
                {!sign && <span className="guide-reel-none">—</span>}
            </div>
        </div>
    );
};

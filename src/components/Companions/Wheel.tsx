import React, { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Glyph } from "../Glyph/Glyph";
import { GLYPH_ORDER, GlyphKey } from "../Glyph/glyphs";
import { CHARACTERS } from "./companions";
import "./Companions.css";

interface WheelProps {
    owned: GlyphKey[];
    target: GlyphKey | null;
    /** bump to spin to `target` */
    spinKey: number;
    landed: GlyphKey | null;
    reduce: boolean;
    onLand: (key: GlyphKey) => void;
}

const N = GLYPH_ORDER.length;
const STEP = 360 / N;

// The wheel of the twelve: the ones already with the author are in ink, the others are only
// outlines waiting to be met. Thrown hard, it slows by exponential decay and stops on the pointer —
// no bounce back, the product does not overshoot. Signs stay upright while the disc turns.
export const Wheel: React.FC<WheelProps> = ({ owned, target, spinKey, landed, reduce, onLand }) => {
    const discRef = useRef<HTMLDivElement>(null);
    const faceRefs = useRef<(HTMLDivElement | null)[]>([]);
    const rotation = useRef(-STEP * 0.5);
    const onLandRef = useRef(onLand);
    onLandRef.current = onLand;

    const layout = (velocity = 0) => {
        const disc = discRef.current;
        if (!disc) return;
        disc.style.transform = `rotate(${rotation.current}deg)`;
        disc.style.filter = Math.abs(velocity) > 0.4 ? `blur(${Math.min(2.4, Math.abs(velocity) * 0.12).toFixed(2)}px)` : "";
        faceRefs.current.forEach((face, i) => {
            if (face) face.style.transform = `rotate(${-(i * STEP + rotation.current)}deg)`;
        });
    };

    useLayoutEffect(() => {
        layout();
    });

    useEffect(() => {
        if (!target || spinKey === 0) return;
        const index = GLYPH_ORDER.indexOf(target);
        const from = rotation.current;
        // item i sits at i·STEP clockwise from the top; it is under the pointer when rotation ≡ −i·STEP
        const rest = ((((-index * STEP - from) % 360) + 360) % 360);
        const to = from + 360 * 4 + rest;
        if (reduce) {
            rotation.current = to;
            layout();
            onLandRef.current(target);
            return;
        }
        const proxy = { r: from };
        let last = from;
        const tween = gsap.to(proxy, {
            r: to,
            duration: 3.4,
            ease: "power4.out",
            onUpdate: () => {
                const v = proxy.r - last;
                last = proxy.r;
                rotation.current = proxy.r;
                layout(v);
            },
            onComplete: () => {
                rotation.current = to;
                layout();
                onLandRef.current(target);
            },
        });
        return () => {
            tween.kill();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spinKey]);

    return (
        <div className="wheel">
            <div className="wheel-pointer" aria-hidden="true" />
            <div className="wheel-disc" ref={discRef}>
                {GLYPH_ORDER.map((key, i) => (
                    <div
                        key={key}
                        className={`wheel-slot ${owned.includes(key) || key === "ktmz" ? "is-owned" : ""} ${landed === key ? "is-hit" : ""}`}
                        style={{ transform: `rotate(${i * STEP}deg) translateY(calc(var(--wheel-r) * -1))` }}
                    >
                        <div className="wheel-face" ref={(el) => { faceRefs.current[i] = el; }}>
                            <Glyph name={key} phase={i * 5} className="wheel-glyph" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="wheel-hub" aria-live="polite">
                {landed ? CHARACTERS[landed].name : "?"}
            </div>
        </div>
    );
};

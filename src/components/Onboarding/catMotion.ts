import { CAT_INK } from "../Glyph/glyphs";

// The cat box is CAT_BASE px at scale 1; it is placed with transform-origin 0 0,
// so a pose is the box's top-left corner plus its scale.
export const CAT_BASE = 120;

export interface Pose {
    x: number;
    y: number;
    s: number;
}

// Stand the cat on a horizontal line: the ink's horizontal middle at inkX, its paws on lineY
export const poseOnLine = (inkX: number, lineY: number, s: number): Pose => {
    const size = CAT_BASE * s;
    const inkMiddle = (CAT_INK.left + CAT_INK.right) / 2;
    return { x: inkX - inkMiddle * size, y: lineY - CAT_INK.bottom * size, s };
};

export const poseFromRect = (rect: DOMRect): Pose => ({
    x: rect.left,
    y: rect.top,
    s: rect.width / CAT_BASE,
});

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// Step response of a damped spring, normalised to t ∈ [0, 1], usable as a GSAP ease.
// `cycles` — how many natural periods fit into the tween; with ζ 0.5 and 1.6 cycles
// the residual at t = 1 is under 0.1 %, so the last frame does not snap.
export const springEase = (zeta: number, cycles: number) => {
    const omega = 2 * Math.PI * cycles;
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    return (t: number) => {
        if (t >= 1) return 1;
        const e = Math.exp(-zeta * omega * t);
        return 1 - e * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
    };
};

// The cat is the only thing on the site that may overshoot (ζ 0.5, like the framer
// defaults in the mini-tree); everything else stays on the product's overdamped physics.
export const CAT_SPRING = springEase(0.5, 1.6);
export const SOFT_SPRING = springEase(0.75, 1.2);

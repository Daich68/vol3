import ear from "../../static/glyphs/ear.webp";
import bliss from "../../static/glyphs/bliss.webp";
import p44 from "../../static/glyphs/p44.webp";
import sad from "../../static/glyphs/sad.webp";
import search from "../../static/glyphs/search.webp";
import soul2 from "../../static/glyphs/soul2.webp";
import tree from "../../static/glyphs/tree.webp";
import ktmz from "../../static/glyphs/ktmz.webp";
import doom from "../../static/glyphs/doom.webp";
import temple from "../../static/glyphs/temple.webp";
import fb from "../../static/glyphs/fb.webp";
import bnd from "../../static/glyphs/bnd.webp";

// Sprite strips of the dictionary signs (ink #111 on transparent, 256 px frames).
// Unlike the GIFs, a strip is driven by our own clock: it can boil faster, slower or freeze.
// `hold` — how many 60 fps ticks each frame stays (from the GIF frame delays), so every
// period divides 6.0 s: the signs boil out of phase but never drift apart.

export type GlyphKey =
    | "ear" | "bliss" | "p44" | "sad" | "search" | "soul2"
    | "tree" | "ktmz" | "doom" | "temple" | "fb" | "bnd";

interface GlyphInfo {
    tag: string;
    src: string;
    hold: number[];
}

export const GLYPHS: Record<GlyphKey, GlyphInfo> = {
    ear: { tag: ":gif-ear:", src: ear, hold: [15, 15, 15] },
    bliss: { tag: ":gif-bliss:", src: bliss, hold: [12, 12, 12] },
    p44: { tag: ":gif-p-44:", src: p44, hold: [30, 30, 30] },
    sad: { tag: ":gif-sad:", src: sad, hold: [12, 12, 12] },
    search: { tag: ":gif-search:", src: search, hold: [10, 10, 10] },
    soul2: { tag: ":gif-soul2:", src: soul2, hold: [10, 10, 10] },
    tree: { tag: ":gif-tree:", src: tree, hold: [15, 15, 15] },
    ktmz: { tag: ":gif-ktmz:", src: ktmz, hold: [20, 20, 20] },
    doom: { tag: ":gif-doom:", src: doom, hold: [15, 15, 15] },
    temple: { tag: ":gif-temple:", src: temple, hold: [30, 30, 30, 30] },
    fb: { tag: ":gif-fb:", src: fb, hold: [15, 15, 15] },
    bnd: { tag: ":gif-bnd:", src: bnd, hold: [10, 10, 10] },
};

// Same order as the picker in WritePostModal (Gifs.tsx)
export const GLYPH_ORDER: GlyphKey[] = [
    "ear", "bliss", "p44", "sad", "search", "soul2", "tree", "ktmz", "doom", "temple", "fb", "bnd",
];

// Ink box of the cat inside its frame (fractions of the frame), measured on the strip
export const CAT_INK = { left: 0.098, right: 0.828, bottom: 0.961 };

export function glyphFrame(key: GlyphKey, t: number, phaseTicks = 0): number {
    const hold = GLYPHS[key].hold;
    const period = hold.reduce((a, b) => a + b, 0);
    let f = Math.floor(t * 60 + 1e-6) + phaseTicks;
    f = ((f % period) + period) % period;
    for (let i = 0; i < hold.length; i++) {
        if (f < hold[i]) return i;
        f -= hold[i];
    }
    return 0;
}

export function preloadGlyphs(keys: GlyphKey[]): Promise<void> {
    return Promise.all(
        keys.map(
            (key) =>
                new Promise<void>((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                    img.src = GLYPHS[key].src;
                })
        )
    ).then(() => undefined);
}

// The sign a text "produces": same text, same sign (FNV-1a over the trimmed text)
export function glyphForText(text: string): GlyphKey {
    let h = 0x811c9dc5;
    for (const ch of text.trim()) {
        h ^= ch.codePointAt(0) || 0;
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return GLYPH_ORDER[h % GLYPH_ORDER.length];
}

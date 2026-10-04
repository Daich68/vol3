import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Glyph } from '../Glyph/Glyph';
import { GlyphKey, preloadGlyphs } from '../Glyph/glyphs';
import './Preloader.css';

interface PreloaderProps {
    onComplete: () => void;
    /** catRect is passed when the cat outlives the curtain and someone else takes it from here */
    onStartExit?: (catRect: DOMRect | null) => void;
    keepCat?: boolean;
    /** the guide has drawn its own cat over ours — hide ours in the same frame */
    catHandedOff?: boolean;
}

// III · РАСШИФРОВКА from the Behance case, as a loader: the word stands as boiling signs and
// decodes letter by letter while the page loads. The cat at the end never decodes — it is a sign,
// not a letter, and the line reads the way a post does: words, then a sign.
const WORD = 'вольтри';
// signs whose silhouette rhymes with the letter: the spiral is О, the tree is Л, the roof is Т
const WORD_GLYPHS: GlyphKey[] = ['ear', 'sad', 'tree', 'p44', 'temple', 'search', 'doom'];
const STEP = 0.17;      // decode cadence of the ch3 band, s
const MIN_TIME = 1600;  // ms
const MAX_WAIT = 5000;  // ms

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const pageLoaded = () => new Promise<void>((resolve) => {
    if (document.readyState === 'complete') return resolve();
    window.addEventListener('load', () => resolve(), { once: true });
});

export const Preloader: React.FC<PreloaderProps> = ({ onComplete, onStartExit, keepCat = false, catHandedOff = false }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const footerRef = useRef<HTMLDivElement>(null);
    const captionRef = useRef<HTMLParagraphElement>(null);
    const counterRef = useRef<HTMLSpanElement>(null);
    const statusRef = useRef<HTMLSpanElement>(null);
    const catRef = useRef<HTMLSpanElement>(null);
    const chRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const glRefs = useRef<(HTMLSpanElement | null)[]>([]);

    // the timeline below runs once; callbacks are read at call time
    const callbacks = useRef({ onComplete, onStartExit, keepCat });
    callbacks.current = { onComplete, onStartExit, keepCat };

    useEffect(() => {
        const chs = chRefs.current.filter(Boolean) as HTMLSpanElement[];
        const gls = glRefs.current.filter(Boolean) as HTMLSpanElement[];
        const cat = catRef.current;
        const n = chs.length;
        const progress = { p: 0 };
        let decoded = 0;
        let nextAt = 0;
        let allDecodedAt = -1;
        let ready = false;
        let exiting = false;
        let alive = true;
        let fill: gsap.core.Tween | null = null;

        const ctx = gsap.context(() => {
            gsap.set(chs, { opacity: 0, y: '0.06em' });
            gsap.set([...gls, cat], { opacity: 0, scale: 0.86 });
            gsap.set([captionRef.current, footerRef.current], { opacity: 0 });
        }, rootRef);

        const setStatus = (text: string) => {
            if (statusRef.current && statusRef.current.textContent !== text) statusRef.current.textContent = text;
        };

        // a sign falls apart and the letter rises out of it, the way a tooltip rises (0.4 s expo)
        const decode = (i: number) => {
            gsap.to(gls[i], { opacity: 0, scale: 0.8, duration: 0.25, ease: 'power2.in' });
            gsap.to(chs[i], { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out', delay: 0.12 });
        };

        const exit = () => {
            exiting = true;
            gsap.ticker.remove(tick);
            setStatus('ACCESS_GRANTED');
            const { keepCat: keep, onStartExit: startExit } = callbacks.current;
            const catRect = keep && cat ? cat.getBoundingClientRect() : null;
            document.documentElement.classList.remove('is-preloading');
            startExit?.(catRect);

            // the curtain lifts; its edge passes through the word from below
            gsap.timeline({ onComplete: () => callbacks.current.onComplete() })
                .to(footerRef.current, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0)
                .to(stageRef.current, { y: -40, duration: 1.1, ease: 'power3.inOut' }, 0.1)
                .to(rootRef.current, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'power4.inOut' }, 0.1);
        };

        // letters never decode faster than the ch3 rhythm and never ahead of the real progress:
        // a queue, not a direct mapping, so a slow network still reads as a steady decoding
        const tick = () => {
            const now = gsap.ticker.time;
            const target = Math.min(n, Math.floor(progress.p * n + 1e-6));
            if (decoded < target && now >= nextAt) {
                decode(decoded++);
                nextAt = now + STEP;
                if (decoded === n) allDecodedAt = now;
            }
            if (counterRef.current) {
                counterRef.current.textContent = String(Math.round(progress.p * 100)).padStart(3, '0');
            }
            if (decoded > 0 && decoded < n) setStatus('DECODING');
            if (decoded === n && ready && !exiting && now - allDecodedAt > 0.55) exit();
        };

        const fontsReady = document.fonts
            ? document.fonts.load('900 1em Entropia').then(() => undefined, () => undefined)
            : Promise.resolve();
        const assets = Promise.race([
            Promise.all([preloadGlyphs([...WORD_GLYPHS, 'ktmz']), fontsReady]).then(() => undefined),
            wait(1500),
        ]);

        assets.then(() => {
            if (!alive) return;
            gsap.timeline()
                .to(gls, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out', stagger: 0.05 }, 0)
                .to(cat, { opacity: 1, scale: 1, duration: 0.9, ease: 'expo.out' }, 0.38)
                .fromTo(captionRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, 0.3)
                .to(footerRef.current, { opacity: 1, duration: 1, ease: 'power2.out' }, 0.4);
            fill = gsap.to(progress, { p: 0.86, duration: 1.8, ease: 'power2.out', delay: 0.35 });
            gsap.ticker.add(tick);
        });

        Promise.all([Promise.race([pageLoaded(), wait(MAX_WAIT)]), wait(MIN_TIME), assets]).then(() => {
            if (!alive) return;
            fill?.kill();
            gsap.to(progress, { p: 1, duration: 0.5, ease: 'power2.inOut', onComplete: () => { ready = true; } });
        });

        return () => {
            alive = false;
            gsap.ticker.remove(tick);
            ctx.revert();
        };
    }, []);

    return (
        <div className="preloader" ref={rootRef}>
            <div className="preloader-stage" ref={stageRef}>
                <div className="preloader-word" role="img" aria-label="вольтри">
                    {Array.from(WORD).map((ch, i) => (
                        <span className="preloader-letter" key={i}>
                            <span className="preloader-ch" ref={(el) => { chRefs.current[i] = el; }}>{ch}</span>
                            <Glyph
                                name={WORD_GLYPHS[i]}
                                phase={i * 7}
                                className="preloader-gl"
                                ref={(el) => { glRefs.current[i] = el; }}
                            />
                        </span>
                    ))}
                    <span className="preloader-cat-slot">
                        <Glyph
                            name="ktmz"
                            phase={49}
                            className="preloader-cat"
                            ref={catRef}
                            style={catHandedOff ? { visibility: 'hidden' } : undefined}
                        />
                    </span>
                </div>
                <p className="preloader-caption" ref={captionRef}>каждый знак — чьё-то слово</p>
            </div>

            <div className="preloader-footer" ref={footerRef}>
                <div className="preloader-meta">
                    <span>INDEX.VOL_3</span>
                    <span ref={statusRef}>LOADING_ASSETS</span>
                </div>
                <span className="preloader-counter" ref={counterRef}>000</span>
            </div>
        </div>
    );
};

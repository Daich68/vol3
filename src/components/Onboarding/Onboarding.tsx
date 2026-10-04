import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { Glyph } from "../Glyph/Glyph";
import { CAT_INK, GLYPHS, GLYPH_ORDER, GlyphKey, glyphForText } from "../Glyph/glyphs";
import { Speech } from "./Speech";
import { SignReel } from "./SignReel";
import { Decoded } from "./Decoded";
import { CAT_BASE, CAT_SPRING, Pose, lerp, poseFromRect, poseOnLine } from "./catMotion";
import {
    CatDestination,
    clearDraft,
    getGuideState,
    isGuest,
    isHomePath,
    isQuietToday,
    lastSeen,
    loadDraft,
    markSeen,
    saveDraft,
    setGuideState,
    setQuietToday,
    todayKey,
} from "./onboardingState";
import { TOUR, TOUR_END, TOUR_SKIPPED, chatter, timeOfDayKey } from "./companionLines";
import { GuideEntry, OnboardingContext } from "./OnboardingContext";
import { loginRequest, regRequest } from "../../api/Login";
import { GetAuthors, GetDictByAuthorID, GetPostsByAuthorID, SaveDict, SendPost } from "../../requests/Api";
import { Author, DictEntry, Token } from "../../entity/Entity";
import {
    CHARACTERS,
    COLLECTIBLE,
    CompanionRecord,
    canSpinToday,
    dayKey,
    deadline,
    firstRecord,
    isAlive,
    loadRecord,
    saveRecord,
    visit,
} from "../Companions/companions";
import { Wheel } from "../Companions/Wheel";
import { Countdown } from "../Companions/Countdown";
import { safeLocalStorage } from "../../utils/localStorage";
import { LOGIN_HINT, PASSWORD_HINT, validateLogin, validatePassword } from "../../utils/authValidation";
import { GetPrettyTimePub } from "../../utils/DatetimeUtils";
import { useMusic } from "../../contexts/MusicContext";
import "./Onboarding.css";

// hidden → handoff (the cat is taken from the preloader) → arriving (jumps onto the window as it opens)
// → open → closing (back to her seat on the page frame) → seated → arriving … ;
// touring — after the first note she walks the author around their page; leaving — she folds away
type Phase = "hidden" | "handoff" | "arriving" | "open" | "closing" | "seated" | "touring" | "leaving";
type Step = "intro" | "write" | "sign" | "auth" | "publishing" | "done" | "wait" | "wheel";

interface PublishResult {
    authorId: string;
    postId?: string;
    number: number;
    date: Date;
}

interface BubbleAction {
    label: string;
    onClick: () => void;
    primary?: boolean;
}

// a line she says beside her seat: chatter goes away by itself, tour and promises wait for an answer
interface Bubble {
    key: number;
    text: string;
    actions?: BubbleAction[];
    sticky?: boolean;
    chatter?: boolean;
}

// the author's companions as the cat knows them; null until loaded
interface CompanionState {
    record: CompanionRecord | null;
    /** the ones that left after three days away — she has to say it */
    lost: GlyphKey[];
}

interface WheelState {
    target: GlyphKey | null;
    spinKey: number;
    landed: GlyphKey | null;
    isNew: boolean;
    spinning: boolean;
}

const WHEEL_IDLE: WheelState = { target: null, spinKey: 0, landed: null, isNew: false, spinning: false };

const TAG_TO_KEY = Object.fromEntries(GLYPH_ORDER.map((k) => [GLYPHS[k].tag, k])) as Record<string, GlyphKey>;
// the GIF alt texts in posts ("Ear GIF", "P-44 GIF") → sign keys
const altToKey = (alt: string): GlyphKey | undefined =>
    TAG_TO_KEY[`:gif-${alt.replace(/\s*gif\s*$/i, "").trim().toLowerCase()}:`];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const MAX_LENGTH = 10000; // same as WritePostModal
const EASE = [0.16, 1, 0.3, 1] as const; // the product's one curve
const STEP_INDEX: Record<Step, number> = { intro: 1, write: 2, sign: 3, auth: 4, publishing: 4, done: 4, wait: 4, wheel: 4 };

// the rules of the place, decoded out of signs the way the preloader decodes the name
const FACTS: { num: string; label: string; glyph: GlyphKey }[] = [
    { num: "01", label: "запись в день", glyph: "ear" },
    { num: "00", label: "правок и удалений", glyph: "sad" },
    { num: "12", label: "знаков твоего языка", glyph: "tree" },
];

const LINES = {
    intro: "привет. я кошка из словаря вольтри. здесь пишут медленно: одна запись в день, и она остаётся навсегда.",
    introAgain: "с возвращением. черновик на месте — продолжим?",
    write: "напиши что-нибудь. не торопись — сегодня это твоя единственная запись.",
    sign: "у каждой записи может быть знак. вот какой выпал тебе.",
    auth: "ой. запись не может быть ничьей. давай познакомимся — это быстро.",
    publishing: "несу на дерево…",
    publishError: "дерево не отвечает. проверь сеть, и попробуем ещё раз.",
    done: "готово. запись осталась на дереве — навсегда. и вот, держи: у тебя появился компаньон.",
    doneKept: "готово. запись осталась на дереве — навсегда. следующая будет завтра.",
    wait: "сегодня у тебя уже есть запись. эта подождёт до завтра — черновик я сохраню.",
};

// steps cross-fade: the old block leaves out of the flow, the new one comes in by the product curve
const blockVariants: Variants = {
    hidden: {},
    shown: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
    exit: { opacity: 0, y: -8, filter: "blur(3px)", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 12, filter: "blur(3px)" },
    shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
};

const isMobile = () => window.innerWidth <= 768;

interface OnboardingProviderProps {
    children: React.ReactNode;
    /** where the cat goes when the preloader curtain lifts */
    arrival: CatDestination;
    /** the preloader cat's box at that moment */
    handoff: DOMRect | null;
    loaded: boolean;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children, arrival, handoff, loaded }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { playButtonSound } = useMusic();
    const reduce = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

    const [phase, setPhase] = useState<Phase>("hidden");
    const [step, setStep] = useState<Step>("intro");
    const [guest, setGuest] = useState(isGuest);
    const [blend, setBlend] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [returning, setReturning] = useState(false);
    const [contentHeight, setContentHeight] = useState<number>();

    // the note
    const draft = useMemo(loadDraft, []);
    const [text, setText] = useState(draft?.text || "");
    const [sign, setSign] = useState<GlyphKey | null>(draft?.sign ?? null);
    const [signPicked, setSignPicked] = useState(draft?.signPicked || false);
    const [meaning, setMeaning] = useState(draft?.meaning || "");
    const [spin, setSpin] = useState({ key: 0, long: true });
    const [signLanded, setSignLanded] = useState(false);

    // the quick sign-in
    const [mode, setMode] = useState<"register" | "login">("register");
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [authMsg, setAuthMsg] = useState("");
    const [busy, setBusy] = useState(false);
    const [publishError, setPublishError] = useState(false);
    const [result, setResult] = useState<PublishResult | null>(null);

    const catRef = useRef<HTMLDivElement>(null);
    const leanRef = useRef<HTMLSpanElement>(null);
    const squashRef = useRef<HTMLSpanElement>(null);
    const breathRef = useRef<HTMLSpanElement>(null);
    const windowRef = useRef<HTMLDivElement>(null);
    const toplineRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const veilRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const ticketRef = useRef<HTMLDivElement>(null);
    const boltRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const cardRef = useRef<HTMLElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const bubbleRef = useRef<HTMLDivElement>(null);

    const pose = useRef<Pose>({ x: -9999, y: -9999, s: 1 });
    const placed = useRef(false);
    const lastNod = useRef(0);
    const [hovering, setHovering] = useState(false);
    // false while the seated cat steps aside (login page, a page without the frame)
    const [seatShown, setSeatShown] = useState(true);

    // the companion: what she says, where the tour is, what she promised for tomorrow
    const [bubble, setBubble] = useState<Bubble | null>(null);
    const bubbleKey = useRef(0);
    const lastSpoke = useRef(0);
    const ruleCooldown = useRef<Record<string, number>>({});
    const pendingLine = useRef<string | null>(null);
    const afterFold = useRef<"seat" | "tour">("seat");
    const [tourIndex, setTourIndex] = useState(0);
    const tourTarget = useRef<{ el: HTMLElement; place: "top" | "right" } | null>(null);
    const spotted = useRef<HTMLElement | null>(null);
    const hopping = useRef(false);
    const [companion, setCompanion] = useState<CompanionState | null>(null);
    const [wheel, setWheel] = useState<WheelState>(WHEEL_IDLE);
    const [granted, setGranted] = useState<GlyphKey | null>(null);
    const greeted = useRef(false);
    // timers and listeners read the current state through this, not through stale closures
    const live = useRef({ phase, seatShown, bubble: false, companion });
    live.current = { phase, seatShown, bubble: !!bubble, companion };

    const catMounted = phase !== "hidden";
    const windowShown = phase === "arriving" || phase === "open" || phase === "closing" || phase === "leaving";

    // ---------------------------------------------------------------- the cat's voice
    // The line boils faster while she talks and calms down when she is silent:
    // three registers — the boil (always), the speech (fades), the jumps (once).
    // On the frame she dozes: the line boils at half speed until someone comes close.
    const catRate = useRef(1);
    const speaking = useRef(false);
    const dozing = useRef(false);
    const boostState = useRef({ until: 0, rate: 1 });

    const syncRate = useCallback(() => {
        const b = boostState.current;
        catRate.current = performance.now() < b.until
            ? b.rate
            : speaking.current ? 3.2 : dozing.current ? 0.5 : 1;
    }, []);

    useEffect(() => {
        dozing.current = phase === "seated" && !hovering && !bubble;
        syncRate();
    }, [phase, hovering, bubble, syncRate]);

    const boost = useCallback((rate: number, ms: number) => {
        boostState.current = { until: performance.now() + ms, rate };
        syncRate();
        window.setTimeout(syncRate, ms + 20);
    }, [syncRate]);

    const onSpeaking = useCallback((value: boolean) => {
        speaking.current = value;
        syncRate();
    }, [syncRate]);

    // ---------------------------------------------------------------- the cat's body
    // her line hangs beside her head, on the side with more room, and never leaves the screen;
    // it follows her through every frame of a jump
    const placeBubble = useCallback(() => {
        const el = bubbleRef.current;
        if (!el) return;
        const size = CAT_BASE * pose.current.s;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const inkL = pose.current.x + CAT_INK.left * size;
        const inkR = pose.current.x + CAT_INK.right * size;
        let side: "left" | "right" = (inkL + inkR) / 2 > vw * 0.55 ? "left" : "right";
        let left = side === "right" ? inkR + 10 : inkL - 10 - w;
        if (left < 8) {
            side = "right";
            left = inkR + 10;
        }
        left = Math.max(8, Math.min(left, vw - 8 - w));
        const top = Math.max(8, Math.min(pose.current.y + size * 0.32 - h, vh - h - 8));
        gsap.set(el, { x: left, y: top });
        el.dataset.side = side;
    }, []);

    const applyPose = useCallback(() => {
        if (!catRef.current) return;
        gsap.set(catRef.current, { x: pose.current.x, y: pose.current.y, scale: pose.current.s });
        placed.current = true;
        placeBubble();
    }, [placeBubble]);

    const dialogPose = useCallback((): Pose | null => {
        const win = windowRef.current;
        if (!win) return null;
        const r = win.getBoundingClientRect();
        const mobile = isMobile();
        return poseOnLine(r.left + (mobile ? 48 : 72), r.top + 1, mobile ? 0.72 : 1);
    }, []);

    // on the page frame: sitting on the top border above the scroll column; on a phone,
    // peeking up from the bottom edge, which cuts her in half
    const framePose = useCallback((): Pose | null => {
        const layout = document.querySelector(".page-frame-layout");
        if (!layout) return null;
        const r = layout.getBoundingClientRect();
        if (r.width === 0) return null;
        if (isMobile()) {
            const s = 0.62;
            return poseOnLine(r.left + 54, window.innerHeight + CAT_BASE * s * 0.3, s);
        }
        const side = document.querySelector(".page-frame-sidebar")?.getBoundingClientRect();
        const x = side && side.width > 0 ? side.left + side.width / 2 : r.right - 90;
        return poseOnLine(x, r.top + 1, 0.5);
    }, []);

    // on a page element during the tour: on its top edge, or standing beside it on its bottom line
    // when there is no room above (the navigation toggle in the corner)
    const elementPose = useCallback((el: HTMLElement, place: "top" | "right"): Pose => {
        const r = el.getBoundingClientRect();
        const s = isMobile() ? 0.5 : 0.62;
        if (place === "right") return poseOnLine(r.right + 12 + CAT_BASE * s * 0.37, r.bottom, s);
        return poseOnLine(r.left + Math.min(64, r.width * 0.3), r.top + 1, s);
    }, []);

    const nod = useCallback(() => {
        const el = squashRef.current;
        if (!el || reduce) return;
        gsap.timeline()
            .to(el, { scaleY: 0.93, scaleX: 1.03, y: 2, duration: 0.09, ease: "power2.out" })
            .to(el, { scaleY: 1, scaleX: 1, y: 0, duration: 0.6, ease: CAT_SPRING });
    }, [reduce]);

    const bounce = useCallback((height: number, times = 1) => {
        const el = squashRef.current;
        const tl = gsap.timeline();
        if (!el || reduce) return tl;
        for (let i = 0; i < times; i++) {
            const h = height * (i === 0 ? 1 : 0.55);
            tl.to(el, { scaleY: 0.86, scaleX: 1.07, duration: 0.1, ease: "power2.out" })
                .to(el, { y: -h, scaleY: 1.07, scaleX: 0.95, duration: 0.2, ease: "power2.out" })
                .to(el, { y: 0, scaleY: 1, scaleX: 1, duration: 0.18, ease: "power2.in" })
                .to(el, { scaleY: 0.88, scaleX: 1.06, duration: 0.06, ease: "power2.out" })
                .to(el, { scaleY: 1, scaleX: 1, duration: 0.5, ease: CAT_SPRING });
        }
        return tl;
    }, [reduce]);

    // A jump along a ballistic arc: crouch, stretch on take-off, squash on landing, settle on a spring
    const hop = useCallback((to: Pose, onLand?: () => void) => {
        const from = { ...pose.current };
        const tl = gsap.timeline();
        if (reduce) {
            tl.to(catRef.current, { opacity: 0, duration: 0.15 })
                .add(() => { pose.current = to; applyPose(); })
                .to(catRef.current, { opacity: 1, duration: 0.2 })
                .add(() => onLand?.());
            return { tl, landAt: 0.15 };
        }
        const sq = squashRef.current;
        hopping.current = true;
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const flight = Math.min(0.8, 0.42 + dist / 2200);
        const arc = Math.min(170, 46 + dist * 0.22);
        const u = { k: 0 };
        const takeoff = 0.13;
        tl.to(sq, { scaleY: 0.86, scaleX: 1.07, duration: takeoff, ease: "power2.out" }, 0)
            .to(sq, { scaleY: 1.08, scaleX: 0.95, duration: 0.14, ease: "power2.out" }, takeoff)
            .to(sq, { scaleY: 1, scaleX: 1, duration: flight * 0.5, ease: "power2.inOut" }, takeoff + 0.14)
            .to(u, {
                k: 1,
                duration: flight,
                ease: "power1.inOut",
                onUpdate: () => {
                    const k = u.k;
                    pose.current = {
                        x: lerp(from.x, to.x, k),
                        y: lerp(from.y, to.y, k) - arc * 4 * k * (1 - k),
                        s: lerp(from.s, to.s, k),
                    };
                    applyPose();
                },
            }, takeoff)
            .to(sq, { scaleY: 0.84, scaleX: 1.09, duration: 0.07, ease: "power2.in" }, takeoff + flight - 0.03)
            .add(() => onLand?.(), takeoff + flight)
            .to(sq, { scaleY: 1, scaleX: 1, duration: 0.7, ease: CAT_SPRING }, takeoff + flight + 0.04)
            .add(() => { hopping.current = false; }, takeoff + flight);
        return { tl, landAt: takeoff + flight };
    }, [reduce, applyPose]);

    // ---------------------------------------------------------------- arrival from the preloader
    useLayoutEffect(() => {
        if (!loaded || !arrival) return;
        if (arrival === "dialog") setReturning(text.trim().length > 0);
        if (handoff) {
            pose.current = poseFromRect(handoff);
            setBlend(true);
            setPhase("handoff");
        } else if (arrival === "dialog") {
            setPhase("arriving");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded, handoff]);

    // place the cat in the same frame it mounts (the preloader hides its own cat in this commit)
    useLayoutEffect(() => {
        if (catMounted && !placed.current) applyPose();
        if (!catMounted) placed.current = false;
    }, [catMounted, applyPose]);

    // the curtain passes through her (difference blend turns her white → black exactly at its edge),
    // she wakes up, and jumps where she is needed
    useEffect(() => {
        if (phase !== "handoff") return;
        boost(1.8, 900);
        const id = window.setTimeout(() => {
            if (arrival === "dialog") {
                setPhase("arriving");
                return;
            }
            const seat = framePose();
            if (!seat) {
                setPhase("hidden");
                return;
            }
            const { tl } = hop(seat, () => setBlend(false));
            tl.eventCallback("onComplete", () => setPhase("seated"));
        }, reduce ? 300 : 620); // the curtain edge has just cleared her
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // ---------------------------------------------------------------- the window opens under her paws
    useLayoutEffect(() => {
        if (phase !== "arriving") return;
        const win = windowRef.current;
        const topline = toplineRef.current;
        const frame = frameRef.current;
        const veil = veilRef.current;
        const dest = dialogPose();
        if (!win || !topline || !frame || !veil || !dest) return;

        setRevealed(false);
        const r = win.getBoundingClientRect();
        const inkX = dest.x + ((CAT_INK.left + CAT_INK.right) / 2) * CAT_BASE * dest.s;
        gsap.set(win, { y: 0 });
        gsap.set(catRef.current, { autoAlpha: 1 });
        gsap.set(frame, { clipPath: "inset(0% 0% 100% 0%)" });
        gsap.set(topline, { scaleX: 0, transformOrigin: `${inkX - r.left}px 50%` });
        gsap.set(veil, { opacity: 0 });
        if (!placed.current || pose.current.y < -CAT_BASE) {
            // nobody handed her over: she drops in from above the screen
            pose.current = { x: dest.x, y: -CAT_BASE * dest.s * 1.6, s: dest.s };
            applyPose();
        }

        const tl = gsap.timeline({ onComplete: () => setPhase("open") });
        tl.to(veil, { opacity: 1, duration: 0.9, ease: "power2.out" }, 0);
        const jump = hop(dest, () => {
            setBlend(false);
            boost(4, 380);
            // the window gives a little under her weight
            if (!reduce) gsap.fromTo(win, { y: 4 }, { y: 0, duration: 0.8, ease: CAT_SPRING });
        });
        tl.add(jump.tl, 0.05);
        const landAt = 0.05 + jump.landAt;
        tl.to(topline, { scaleX: 1, duration: 0.6, ease: "expo.out" }, Math.max(0, landAt - 0.2));
        tl.to(frame, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.75, ease: "expo.out" }, landAt + 0.02);
        tl.add(() => setRevealed(true), landAt + 0.22);
        return () => {
            tl.kill();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // ---------------------------------------------------------------- the window folds back into a line
    useLayoutEffect(() => {
        if (phase !== "closing" && phase !== "leaving") return;
        setRevealed(false);
        const tl = gsap.timeline();
        tl.to(contentRef.current, { opacity: 0, y: -6, duration: 0.22, ease: "power2.in" }, 0)
            .to(frameRef.current, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.45, ease: "power3.in" }, 0.08)
            .to(toplineRef.current, { scaleX: 0, duration: 0.4, ease: "power3.in" }, 0.45)
            .to(veilRef.current, { opacity: 0, duration: 0.6, ease: "power2.inOut" }, 0.15);

        if (phase === "closing" && afterFold.current === "tour") {
            // the line shrinks under her paws, and she sets off around the author's page
            tl.add(() => {
                afterFold.current = "seat";
                setTourIndex(0);
                setPhase("touring");
            }, 0.8);
        } else if (phase === "closing") {
            const seat = framePose();
            if (seat) {
                tl.add(hop(seat).tl, 0.5);
                tl.add(() => setPhase("seated"));
            } else {
                tl.to(catRef.current, { opacity: 0, duration: 0.3 }, 0.5).add(() => setPhase("hidden"));
            }
        } else {
            // after the note: she folds into the point the line shrinks to — a sign again
            tl.to(squashRef.current, { scaleX: 0.15, scaleY: 0.15, opacity: 0, duration: 0.5, ease: "power3.in" }, 0.55)
                .add(() => setPhase("hidden"));
        }
        return () => {
            tl.kill();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    // reset what the folding left behind once the window is gone
    useEffect(() => {
        if (phase === "seated" || phase === "hidden") {
            if (squashRef.current) gsap.set(squashRef.current, { clearProps: "transform,opacity" });
        }
        if (phase === "hidden") setBlend(false);
        // lines belong to the frame and the tour; the window speaks for itself
        if (phase !== "seated" && phase !== "touring") setBubble(null);
    }, [phase]);

    // ---------------------------------------------------------------- life: breath and attention
    useEffect(() => {
        if (!catMounted || reduce || !breathRef.current) return;
        const tween = gsap.to(breathRef.current, {
            scaleY: 1.02,
            scaleX: 0.994,
            duration: 1.7,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
        });
        return () => {
            tween.kill();
        };
    }, [catMounted, reduce]);

    useEffect(() => {
        if (!catMounted || reduce || !leanRef.current) return;
        const lean = gsap.quickTo(leanRef.current, "skewX", { duration: 0.8, ease: "power3.out" });
        const onMove = (e: PointerEvent) => {
            const cx = pose.current.x + CAT_BASE * pose.current.s * 0.46;
            const d = Math.max(-1, Math.min(1, (e.clientX - cx) / 520));
            lean(-d * 6);
        };
        window.addEventListener("pointermove", onMove);
        return () => window.removeEventListener("pointermove", onMove);
    }, [catMounted, reduce]);

    // keep her on her seat when the viewport changes
    useEffect(() => {
        if (phase !== "open" && phase !== "seated") return;
        let raf = 0;
        const onResize = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const seat = phase === "open" ? dialogPose() : framePose();
                if (seat) {
                    pose.current = seat;
                    applyPose();
                }
            });
        };
        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("resize", onResize);
            cancelAnimationFrame(raf);
        };
    }, [phase, dialogPose, framePose, applyPose]);

    // pages change under her: re-seat on the new frame, step aside on the login page, come back after it
    useEffect(() => {
        const nowGuest = isGuest();
        setGuest(nowGuest);
        const onLogin = location.pathname.startsWith("/login");
        // the author walked off mid-tour: she wraps it up on the frame
        if (phase === "touring") {
            setTourIndex(TOUR.length);
            return;
        }
        const belongsOnFrame = !nowGuest || getGuideState() !== null;
        if (phase === "hidden" && belongsOnFrame && !onLogin && loaded) {
            const id = window.setTimeout(() => {
                const seat = framePose();
                if (!seat) return;
                pose.current = seat;
                setPhase("seated");
                if (!reduce) {
                    requestAnimationFrame(() => {
                        gsap.fromTo(catRef.current, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" });
                    });
                }
            }, 120);
            return () => window.clearTimeout(id);
        }
        if (phase !== "seated") return;
        setHovering(false);
        setBubble((b) => (b && b.chatter ? null : b));
        const id = window.setTimeout(() => {
            const seat = framePose();
            if (!seat || onLogin) {
                setSeatShown(false);
                gsap.to(catRef.current, { autoAlpha: 0, duration: 0.3 });
                return;
            }
            setSeatShown(true);
            pose.current = seat;
            applyPose();
            gsap.to(catRef.current, { autoAlpha: 1, duration: 0.3 });
        }, 80);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    // ---------------------------------------------------------------- draft
    useEffect(() => {
        if (getGuideState() === "done") return;
        if (text.trim()) saveDraft({ text, sign, signPicked, meaning });
        else clearDraft();
    }, [text, sign, signPicked, meaning]);

    // the window grows and shrinks with its content; its top edge — her seat — never moves
    useLayoutEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        const observer = new ResizeObserver(() => setContentHeight(el.offsetHeight));
        observer.observe(el);
        setContentHeight(el.offsetHeight);
        return () => observer.disconnect();
    }, [windowShown]);

    // ---------------------------------------------------------------- steps
    const go = useCallback((next: Step) => {
        playButtonSound();
        setStep(next);
    }, [playButtonSound]);

    // focus the step's main control once it has come in
    useEffect(() => {
        if (!revealed) return;
        const id = window.setTimeout(() => {
            const el = contentRef.current?.querySelector<HTMLElement>("[data-autofocus]");
            el?.focus({ preventScroll: true });
        }, 450);
        return () => window.clearTimeout(id);
    }, [step, revealed]);

    // the note produces its sign, unless the author picked one by hand; set in the same batch
    // as the step, so the reel mounts already knowing what it will land on
    const toSign = () => {
        playButtonSound();
        setSignLanded(false);
        if (!signPicked) setSign(glyphForText(text));
        setSpin((s) => ({ key: s.key + 1, long: true }));
        setStep("sign");
    };

    const openGuide = useCallback((entry: GuideEntry = "intro") => {
        if (!isGuest()) {
            navigate("/person");
            return;
        }
        if (phase === "arriving" || phase === "closing" || phase === "leaving" || phase === "handoff") return;
        setReturning(entry === "intro" && text.trim().length > 0);
        setStep(entry);
        if (phase !== "open") setPhase("arriving");
    }, [phase, navigate, text]);

    const requestClose = useCallback(() => {
        if (phase !== "open" || busy || step === "publishing") return;
        playButtonSound();
        if (step === "wheel" && wheel.spinning) return;
        if (step === "done" || step === "wait" || step === "wheel") {
            // she stays with the author now: back to her seat on the frame
            if (step === "done") pendingLine.current = TOUR_SKIPPED;
            setPhase("closing");
            return;
        }
        setGuideState("later");
        greeted.current = true;
        pendingLine.current = "ладно. я посижу тут, на рамке. позовёшь — приду.";
        setPhase("closing");
    }, [phase, busy, step, playButtonSound, wheel.spinning]);

    useEffect(() => {
        if (phase !== "open") return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") requestClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [phase, requestClose]);

    // focus stays inside the window; the list of controls changes with every step, so it is read on each Tab
    const trapTab = (e: React.KeyboardEvent) => {
        if (e.key !== "Tab" || !windowRef.current) return;
        const items = Array.from(
            windowRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled])")
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            last.focus();
            e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
            first.focus();
            e.preventDefault();
        }
    };

    const onType = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value.slice(0, MAX_LENGTH);
        setText(value);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.34)}px`;
        // she listens: a small nod every few keystrokes and the line trembles with the typing
        const now = performance.now();
        if (now - lastNod.current > 160) {
            lastNod.current = now;
            nod();
        }
        boost(2.2, 260);
    };

    useLayoutEffect(() => {
        if (step !== "write" || !textareaRef.current) return;
        const el = textareaRef.current;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.34)}px`;
    });

    const onSignLand = useCallback(() => {
        setSignLanded(true);
        nod();
        boost(3.4, 320);
    }, [nod, boost]);

    const pick = (key: GlyphKey | null) => {
        setSignPicked(true);
        if (key === sign) return;
        setSign(key);
        if (key) {
            setSignLanded(false);
            setSpin((s) => ({ key: s.key + 1, long: false }));
        }
    };

    const noteText = () => (sign ? `${text.trim()} ${GLYPHS[sign].tag}` : text.trim());

    // the note leaves as a discharge — «каждый импульс — это разряд, который остаётся в пространстве навсегда»
    const discharge = () => new Promise<void>((resolve) => {
        const ticket = ticketRef.current;
        const bolt = boltRef.current;
        const win = windowRef.current;
        if (!ticket || !bolt || !win || reduce) return resolve();
        const tr = ticket.getBoundingClientRect();
        const wr = win.getBoundingClientRect();
        gsap.set(bolt, { left: tr.left - wr.left + tr.width / 2, top: tr.top - wr.top, height: tr.height, y: 0, opacity: 0 });
        gsap.timeline({ onComplete: resolve })
            .to(ticket, { scaleY: 0.05, opacity: 0.5, duration: 0.26, ease: "power3.in" })
            .to(ticket, { scaleX: 0.003, duration: 0.18, ease: "power3.in" })
            .set(bolt, { opacity: 1 }, "-=0.06")
            .add(() => { bounce(10); boost(5, 500); }, "<")
            .to(bolt, { y: -(tr.top + tr.height + 80), height: tr.height * 0.5, duration: 0.5, ease: "power3.in" })
            .to(bolt, { opacity: 0, duration: 0.12 }, "-=0.12");
    });

    const publish = async (authorId: string) => {
        setStep("publishing");
        setPublishError(false);
        try {
            const posts = await GetPostsByAuthorID(authorId);
            const today = new Date().toLocaleDateString();
            if (posts.length > 0 && new Date(posts[0].time_publication).toLocaleDateString() === today) {
                setResult({ authorId, number: posts.length, date: new Date() });
                setStep("wait");
                return;
            }
            await SendPost({ time_publication: new Date(), text: noteText(), author_id: authorId });

            // the first word of the author's language and the first companion, in one dictionary save;
            // the note matters more, so a failure here does not stop it.
            // The companion is the sign the note produced (the cat herself is no companion — then a random one).
            try {
                const word: DictEntry[] = sign && meaning.trim() ? [{ gif_tag: GLYPHS[sign].tag, meaning: meaning.trim() }] : [];
                const existing = await loadRecord(authorId).catch(() => null);
                if (existing && isAlive(existing)) {
                    if (word.length > 0) {
                        const dicts = await GetDictByAuthorID(authorId);
                        const current = dicts[0];
                        const entries = (current?.dict || []).filter((e) => e.gif_tag !== word[0].gif_tag);
                        await SaveDict({ _id: current?._id, dict: [...entries, ...word], author_id: authorId });
                    }
                    setCompanion({ record: existing, lost: [] });
                    setGranted(null);
                } else {
                    const first = sign && sign !== "ktmz" ? sign : COLLECTIBLE[Math.floor(Math.random() * COLLECTIBLE.length)];
                    const record = firstRecord(first);
                    await saveRecord(authorId, record, word);
                    setCompanion({ record, lost: [] });
                    setGranted(first);
                }
            } catch (error) {
                console.error(error);
            }

            let postId: string | undefined;
            try {
                const fresh = await GetPostsByAuthorID(authorId);
                postId = fresh[0]?._id;
            } catch (error) {
                console.error(error);
            }

            setGuideState("done");
            clearDraft();
            setResult({ authorId, postId, number: posts.length + 1, date: new Date() });
            await discharge();
            setStep("done");
        } catch (error) {
            console.error(error);
            setPublishError(true);
        }
    };

    const send = () => {
        playButtonSound();
        const id = safeLocalStorage.getItem("ID");
        if (!isGuest() && id) {
            publish(id);
            return;
        }
        // the note tries to rise and is not let go yet — «ой»
        if (ticketRef.current && !reduce) {
            gsap.timeline()
                .to(ticketRef.current, { y: -18, duration: 0.18, ease: "power2.out" })
                .to(ticketRef.current, { y: 0, duration: 0.7, ease: CAT_SPRING });
        }
        bounce(16);
        boost(6, 450);
        window.setTimeout(() => setStep("auth"), reduce ? 0 : 380);
    };

    const shake = () => {
        nod();
        if (reduce || !formRef.current) return;
        gsap.to(formRef.current, {
            keyframes: [
                { x: -7, duration: 0.07 },
                { x: 6, duration: 0.08 },
                { x: -4, duration: 0.08 },
                { x: 3, duration: 0.08 },
                { x: 0, duration: 0.11 },
            ],
            ease: "power2.out",
        });
    };

    const toggleMode = () => {
        playButtonSound();
        setMode((m) => (m === "register" ? "login" : "register"));
        setLoginError("");
        setPasswordError("");
        setAuthMsg("");
    };

    const submitAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        setAuthMsg("");
        setLoginError("");
        setPasswordError("");
        const name = login.trim();
        let invalid = false;
        if (mode === "register") {
            if (!validateLogin(name)) { setLoginError(LOGIN_HINT); invalid = true; }
            if (!validatePassword(password)) { setPasswordError(PASSWORD_HINT); invalid = true; }
        } else {
            if (!name) { setLoginError("введите идентификатор"); invalid = true; }
            if (!password) { setPasswordError("введите ключ"); invalid = true; }
        }
        if (invalid) {
            shake();
            return;
        }

        setBusy(true);
        try {
            let token: Token;
            if (mode === "register") {
                const authors = await GetAuthors().catch((): Author[] => []);
                if (authors.some((author) => author.login === name)) {
                    setLoginError("такой логин уже существует");
                    shake();
                    setBusy(false);
                    return;
                }
                token = await regRequest({ login: name, password });
            } else {
                token = await loginRequest({ login: name, password });
            }
            safeLocalStorage.setItem("accessToken", token.access);
            safeLocalStorage.setItem("ID", token._id);
            setGuest(false);
            setBusy(false);
            playButtonSound();
            publish(token._id);
        } catch (error) {
            console.error(error);
            setAuthMsg(mode === "register"
                ? "не получилось создать имя. попробуй ещё раз"
                : "не получилось войти. проверь идентификатор и ключ");
            shake();
            setBusy(false);
        }
    };

    // after the note: to the author's page, where she shows what lies where
    const startTour = () => {
        if (!result) return;
        playButtonSound();
        navigate(`/author/${result.authorId}${result.postId ? `?post=${result.postId}` : ""}`);
        afterFold.current = "tour";
        setPhase("closing");
    };

    const toProfile = () => {
        if (!result) return;
        playButtonSound();
        navigate(`/author/${result.authorId}`);
        setPhase("closing");
    };

    const toLogin = () => {
        playButtonSound();
        setGuideState("later");
        navigate("/login");
        setPhase("leaving");
    };

    // the published card crystallises out of a blur, and she jumps twice
    useEffect(() => {
        if (step !== "done" || !revealed) return;
        const id = window.setTimeout(() => {
            if (cardRef.current && !reduce) {
                gsap.fromTo(cardRef.current,
                    { filter: "blur(10px)", opacity: 0, scale: 1.04, letterSpacing: "0.06em" },
                    { filter: "blur(0px)", opacity: 1, scale: 1, letterSpacing: "0em", duration: 0.9, ease: "expo.out" });
            }
            bounce(22, 2);
            boost(4, 900);
        }, 120);
        return () => window.clearTimeout(id);
    }, [step, revealed, bounce, boost, reduce]);

    const purr = () => {
        if (phase === "seated" && isGuest()) {
            openGuide("intro");
            return;
        }
        nod();
        boost(4, 900);
        if (phase === "seated") {
            if (canSpinToday(companion?.record ?? null)) offerWheel();
            else say(chatter("purr"), { force: true });
        }
    };

    // ================================================================ the companion
    // She stays for the whole visit: sits on the frame, dozes, speaks up now and then about
    // the page, the signs, the other authors; walks a new author around; keeps a promise.

    const say = useCallback((text: string | null, opts: { actions?: BubbleAction[]; sticky?: boolean; chatter?: boolean; force?: boolean } = {}) => {
        if (!text) return;
        if (opts.chatter && (isQuietToday() || document.visibilityState !== "visible")) return;
        bubbleKey.current += 1;
        lastSpoke.current = performance.now();
        setBubble({ key: bubbleKey.current, text, actions: opts.actions, sticky: opts.sticky, chatter: opts.chatter });
    }, []);

    const hideBubble = useCallback((key?: number) => {
        setBubble((b) => (b && (key === undefined || b.key === key) ? null : b));
    }, []);

    // a line nobody has to answer leaves once read: a beat after the last letter, longer for longer lines
    const onBubbleSpeaking = useCallback((value: boolean, b: Bubble) => {
        onSpeaking(value);
        if (!value && !b.sticky) window.setTimeout(() => hideBubble(b.key), 2400 + b.text.length * 40);
    }, [onSpeaking, hideBubble]);

    useEffect(() => {
        if (!reduce || !bubble || bubble.sticky) return;
        const id = window.setTimeout(() => hideBubble(bubble.key), 3500 + bubble.text.length * 40);
        return () => window.clearTimeout(id);
    }, [bubble, reduce, hideBubble]);

    // the line keeps its place beside her whatever its size
    useLayoutEffect(() => {
        const el = bubbleRef.current;
        if (!el) return;
        placeBubble();
        const observer = new ResizeObserver(() => placeBubble());
        observer.observe(el);
        return () => observer.disconnect();
    }, [bubble, placeBubble, phase]);

    const quiet = () => {
        playButtonSound();
        setQuietToday();
        say(chatter("quiet"));
    };

    const canChatter = (gap = 18000) => {
        const { phase: p, seatShown: shown, bubble: open } = live.current;
        return p === "seated" && shown && !open && !isQuietToday()
            && !document.querySelector(".dict-modal-overlay.open")
            && performance.now() - lastSpoke.current > gap;
    };

    const writeAction = (): BubbleAction => ({
        label: "написать",
        primary: true,
        onClick: () => {
            hideBubble();
            openGuide("write");
        },
    });

    // what to say about the page she is sitting on
    const routeLine = useCallback((): { text: string | null; actions?: BubbleAction[] } => {
        const path = location.pathname;
        const me = safeLocalStorage.getItem("ID");
        if (isGuest() && Math.random() < 0.35) return { text: chatter("guestNudge"), actions: [writeAction()] };
        if (Math.random() < 0.3) return { text: chatter(timeOfDayKey()) };
        if (isHomePath(path)) return { text: chatter("home") };
        if (path.startsWith("/notes")) return { text: chatter("notes") };
        if (path.startsWith("/search")) {
            const names = Array.from(document.querySelectorAll(".author-card .author-name"))
                .map((n) => n.textContent?.trim())
                .filter(Boolean) as string[];
            if (names.length > 0 && Math.random() < 0.5) {
                return { text: chatter("authorCard", { name: names[Math.floor(Math.random() * names.length)] }) };
            }
            return { text: chatter("search") };
        }
        if (path.startsWith("/author/")) {
            const tiles = document.querySelectorAll(".companion-tile").length;
            if (me && path === `/author/${me}`) {
                return { text: tiles > 0 && Math.random() < 0.45 ? chatter("ownShelf") : chatter("ownPage") };
            }
            const name = document.querySelector(".author-name-hero")?.textContent?.trim();
            if (tiles > 0 && Math.random() < 0.5) {
                return { text: chatter("otherShelf", { name, count: String(tiles) }) || chatter("idle") };
            }
            return { text: chatter("otherPage", { name }) || chatter("idle") };
        }
        return { text: chatter("idle") };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    const sayAboutPage = useCallback(() => {
        const l = routeLine();
        say(l.text, { actions: l.actions, chatter: true });
    }, [routeLine, say]);

    // now and then, unprompted: first after ~half a minute, then every one to one and a half minutes
    useEffect(() => {
        if (phase !== "seated" || !seatShown) return;
        let id = 0;
        const plan = (first: boolean) => {
            id = window.setTimeout(() => {
                if (canChatter()) sayAboutPage();
                plan(false);
            }, (first ? 22000 : 48000) + Math.random() * 42000);
        };
        plan(true);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, seatShown, sayAboutPage]);

    // a new page: sometimes she has a word about it
    useEffect(() => {
        const id = window.setTimeout(() => {
            if (canChatter(12000) && Math.random() < 0.5) sayAboutPage();
        }, 1900);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    // she notices what the pointer rests on: a sign in someone's note, an author, a branch
    useEffect(() => {
        if (phase !== "seated" || !seatShown) return;
        const text = (el: Element | null) => el?.textContent?.trim() || undefined;
        const rules: { sel: string; chance: number; line: (el: HTMLElement) => string | null }[] = [
            {
                sel: ".gif-container",
                chance: 0.5,
                line: (el) => {
                    const key = altToKey(el.querySelector("img")?.getAttribute("alt") || "");
                    return key === "ktmz" ? chatter("signSelf") : chatter("sign", { tag: key ? GLYPHS[key].tag : undefined });
                },
            },
            {
                sel: ".companion-tile",
                chance: 0.6,
                line: (el) => {
                    const key = el.dataset.key as GlyphKey | undefined;
                    return key ? chatter("companionTile", { char: CHARACTERS[key].name, trait: CHARACTERS[key].trait }) : null;
                },
            },
            { sel: ".author-card", chance: 0.4, line: (el) => chatter("authorCard", { name: text(el.querySelector(".author-name")) }) },
            { sel: ".notice-item", chance: 0.35, line: (el) => chatter("notice", { title: text(el.querySelector(".notice-title")) }) },
            { sel: ".branch", chance: 0.4, line: (el) => chatter("branch", { label: text(el.querySelector(".branch-label")) }) },
            {
                sel: ".author-nav-item",
                chance: 0.45,
                line: (el) => (/словар/.test(el.textContent || "") ? chatter("dictButton")
                    : /напис/.test(el.textContent || "") ? chatter("writeButton") : null),
            },
            { sel: ".mini-tree-toggle", chance: 0.3, line: () => chatter("treeToggle") },
            { sel: ".search-input-premium", chance: 0.5, line: () => chatter("searchInput") },
            { sel: ".post-card", chance: 0.18, line: () => chatter("post") },
        ];
        const onOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target || !target.closest) return;
            for (const rule of rules) {
                const el = target.closest<HTMLElement>(rule.sel);
                if (!el) continue;
                const now = performance.now();
                if ((ruleCooldown.current[rule.sel] || 0) > now) return;
                ruleCooldown.current[rule.sel] = now + 90000;
                if (!canChatter(12000) || Math.random() > rule.chance) return;
                say(rule.line(el), { chatter: true });
                return;
            }
        };
        document.addEventListener("mouseover", onOver);
        return () => document.removeEventListener("mouseover", onOver);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, seatShown, say]);

    // ---------------------------------------------------------------- companions
    // A signed-in author: the visit counts towards the streak, or — after three days away —
    // everyone has left. Loaded once per sign-in; the record lives in the author's dictionary.
    useEffect(() => {
        if (!loaded || guest) {
            if (guest) setCompanion(null);
            return;
        }
        const id = safeLocalStorage.getItem("ID");
        if (!id) return;
        let alive = true;
        loadRecord(id)
            .then((r) => {
                if (!alive) return;
                const v = visit(r);
                // the first note may have created a record meanwhile — that one is newer
                setCompanion((prev) => (prev?.record ? prev : { record: v.record, lost: v.lost }));
                if (v.changed && v.record) saveRecord(id, v.record).catch((error) => console.error(error));
            })
            .catch((error) => {
                console.error(error);
                if (alive) setCompanion((prev) => prev || { record: null, lost: [] });
            });
        return () => {
            alive = false;
        };
    }, [loaded, guest]);

    const openWheel = useCallback(() => {
        if (isGuest()) {
            openGuide("intro");
            return;
        }
        hideBubble();
        playButtonSound();
        setWheel(WHEEL_IDLE);
        setStep("wheel");
        if (live.current.phase !== "open") setPhase("arriving");
    }, [hideBubble, playButtonSound, openGuide]);

    // the throw is decided when it starts, and saved at once — closing the tab mid-spin changes nothing
    const spinWheel = () => {
        const id = safeLocalStorage.getItem("ID");
        if (!id || wheel.spinning) return;
        playButtonSound();
        const target = GLYPH_ORDER[Math.floor(Math.random() * GLYPH_ORDER.length)];
        let isNew = false;
        if (target !== "ktmz") {
            const now = new Date().toISOString();
            const current = companion?.record;
            const base: CompanionRecord = current && isAlive(current) ? current : { v: 1, c: [], s: 1, l: now, d: "" };
            isNew = !base.c.includes(target);
            const next: CompanionRecord = { ...base, c: isNew ? [...base.c, target] : base.c, d: dayKey(), l: now };
            setCompanion({ record: next, lost: [] });
            saveRecord(id, next).catch((error) => console.error(error));
        }
        setWheel((w) => ({ target, spinKey: w.spinKey + 1, landed: null, isNew, spinning: true }));
        boost(3, 3400);
    };

    const onWheelLand = useCallback((key: GlyphKey) => {
        setWheel((w) => ({ ...w, landed: key, spinning: false }));
        if (key !== "ktmz" && wheel.isNew) {
            bounce(24, 2);
            boost(5, 1000);
        } else {
            nod();
            boost(3, 400);
        }
    }, [wheel.isNew, bounce, boost, nod]);

    const offerWheel = useCallback(() => {
        const first = !live.current.companion?.record;
        say(chatter(first ? "wheelFirst" : "wheelOffer"), {
            sticky: true,
            actions: [
                { label: "потом", onClick: () => hideBubble() },
                { label: "крутить", primary: true, onClick: openWheel },
            ],
        });
    }, [say, hideBubble, openWheel]);

    // the first moment on the frame: who left, the wheel, a welcome back, a nudge for a guest —
    // or whatever she meant to say after the window closed
    useEffect(() => {
        if (phase !== "seated" || !seatShown) return;
        if (!guest && companion === null) return; // wait until she knows the author's companions
        const id = window.setTimeout(() => {
            if (pendingLine.current) {
                say(pendingLine.current);
                pendingLine.current = null;
                return;
            }
            if (greeted.current) return;
            greeted.current = true;
            if (isGuest()) {
                say(chatter("guestNudge"), { chatter: true, actions: [writeAction()] });
                return;
            }
            const c = live.current.companion;
            if (c && c.lost.length > 0) {
                const names = c.lost.map((k) => CHARACTERS[k].name).join(", ");
                say(`тебя не было больше трёх дней. ${names} — ушли. все. колесо всё равно крутится: начнём сначала?`, {
                    sticky: true,
                    actions: [
                        { label: "потом", onClick: () => hideBubble() },
                        { label: "крутить", primary: true, onClick: openWheel },
                    ],
                });
                setCompanion((prev) => (prev ? { ...prev, lost: [] } : prev));
            } else if (canSpinToday(c?.record ?? null)) {
                offerWheel();
            } else if (lastSeen() && lastSeen() !== todayKey()) {
                say(chatter("back"), { chatter: true });
            }
            markSeen();
        }, 900);
        return () => window.clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, seatShown, companion === null]);

    // ---------------------------------------------------------------- the tour
    const unspot = () => {
        spotted.current?.classList.remove("guide-spot");
        spotted.current = null;
    };

    const waitFor = async (selector: string, ms: number) => {
        const until = performance.now() + ms;
        while (performance.now() < until) {
            const el = Array.from(document.querySelectorAll<HTMLElement>(selector)).find((e) => {
                const r = e.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });
            if (el) return el;
            await wait(120);
        }
        return null;
    };

    useEffect(() => {
        if (phase !== "touring") {
            unspot();
            tourTarget.current = null;
            return;
        }
        let alive = true;
        greeted.current = true;
        setBubble(null);

        const finish = () => {
            unspot();
            tourTarget.current = null;
            const end = () => say(TOUR_END, {
                sticky: true,
                actions: [{ label: "до завтра", primary: true, onClick: () => { playButtonSound(); hideBubble(); setPhase("seated"); } }],
            });
            const seat = framePose();
            if (!seat || Math.hypot(seat.x - pose.current.x, seat.y - pose.current.y) < 4) {
                end();
                return;
            }
            hop(seat, () => { boost(3, 300); end(); });
        };

        (async () => {
            const stop = TOUR[tourIndex];
            if (!stop) {
                finish();
                return;
            }
            // the first stop waits for the author page to load and scroll to the new note
            await wait(tourIndex === 0 ? 1100 : 120);
            const el = stop.place === "frame"
                ? document.querySelector<HTMLElement>(stop.selector)
                : await waitFor(stop.selector, 6000);
            if (!alive) return;
            if (!el) {
                setTourIndex((i) => i + 1);
                return;
            }
            if (stop.scroll) {
                el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
                await wait(reduce ? 50 : 750);
                if (!alive) return;
            }
            const target = stop.place === "frame" ? framePose() : elementPose(el, stop.place);
            if (!target) {
                setTourIndex((i) => i + 1);
                return;
            }
            unspot();
            tourTarget.current = stop.place === "frame" ? null : { el, place: stop.place };
            hop(target, () => {
                if (!alive) return;
                if (stop.place !== "frame") {
                    el.classList.add("guide-spot");
                    spotted.current = el;
                }
                boost(3, 300);
                const last = tourIndex === TOUR.length - 1;
                say(stop.line, {
                    sticky: true,
                    actions: [
                        ...(last ? [] : [{ label: "хватит", onClick: () => setTourIndex(TOUR.length) }]),
                        { label: "дальше", primary: true, onClick: () => { playButtonSound(); setTourIndex((i) => i + 1); } },
                    ],
                });
            });
        })();

        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, tourIndex]);

    // the page scrolls under her during the tour: she stays on her element
    useEffect(() => {
        if (phase !== "touring") return;
        const onScroll = () => {
            const t = tourTarget.current;
            if (!t || hopping.current) return;
            pose.current = elementPose(t.el, t.place);
            applyPose();
        };
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onScroll);
        };
    }, [phase, elementPose, applyPose]);

    // ---------------------------------------------------------------- render
    const wheelLine = () => {
        if (wheel.spinning) return "крутится… не смотри на меня, смотри на колесо.";
        if (wheel.landed === "ktmz") return "это я. я и так с тобой — крути ещё раз, бесплатно.";
        if (wheel.landed) {
            const { name, trait } = CHARACTERS[wheel.landed];
            return wheel.isNew
                ? `${name}! ${trait} теперь он с тобой — пока ты возвращаешься.`
                : `${name} — уже твой. не беда: серия идёт, завтра колесо снова твоё.`;
        }
        if (!canSpinToday(companion?.record ?? null)) return "на сегодня колесо уже крутилось. я считаю, не спорь.";
        return "в словаре двенадцать знаков. я — одна из них, остальных ты сейчас увидишь. кто выпадет — останется с тобой.";
    };

    const line = (() => {
        if (step === "wheel") return wheelLine();
        if (step === "done" && !granted) return LINES.doneKept;
        if (step === "intro") return returning ? LINES.introAgain : LINES.intro;
        if (step === "publishing") return publishError ? LINES.publishError : LINES.publishing;
        return LINES[step];
    })();

    const showTicket = step === "sign" || step === "auth" || step === "publishing" || step === "wait";

    const renderStep = () => {
        switch (step) {
            case "intro":
                return (
                    <>
                        {!returning && (
                            <motion.div className="guide-facts" variants={itemVariants}>
                                {FACTS.map((fact, i) => (
                                    <div className="guide-fact" key={fact.num}>
                                        <span className="guide-fact-num">
                                            <Decoded text={fact.num} glyph={fact.glyph} at={0.55 + i * 0.17} active={revealed} instant={reduce} />
                                        </span>
                                        <span className="guide-fact-label">{fact.label}</span>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                        <motion.div className="guide-actions" variants={itemVariants}>
                            <button className="guide-btn-text" onClick={requestClose}>осмотрюсь сам</button>
                            <button className="guide-btn" data-autofocus onClick={() => go("write")}>
                                {returning ? "продолжить запись" : "написать первую запись"}
                            </button>
                        </motion.div>
                        <motion.button className="guide-link" variants={itemVariants} onClick={toLogin}>
                            у меня уже есть имя — войти
                        </motion.button>
                    </>
                );

            case "write":
                return (
                    <>
                        <motion.div className="guide-field" variants={itemVariants}>
                            <label className="guide-label" htmlFor="guide-note">запись</label>
                            <textarea
                                id="guide-note"
                                ref={textareaRef}
                                className="guide-textarea"
                                value={text}
                                onChange={onType}
                                placeholder="напиши что-то, не торопись..."
                                rows={3}
                                maxLength={MAX_LENGTH}
                                data-autofocus
                                data-lenis-prevent
                            />
                            <span className="guide-meta">
                                {text.length > 0 ? `${text.length} зн. · черновик сохраняется сам` : "черновик сохраняется сам"}
                            </span>
                        </motion.div>
                        <motion.div className="guide-actions" variants={itemVariants}>
                            <button className="guide-btn-text" onClick={() => go("intro")}>назад</button>
                            <button className="guide-btn" disabled={!text.trim()} onClick={toSign}>дальше</button>
                        </motion.div>
                    </>
                );

            case "sign":
                return (
                    <>
                        <motion.div className="guide-sign" variants={itemVariants}>
                            <SignReel sign={sign} spinKey={spin.key} long={spin.long} reduce={reduce} onLand={onSignLand} />
                            <div className="guide-sign-side">
                                <span className="guide-sign-tag">
                                    {sign ? (signLanded ? GLYPHS[sign].tag : "· · ·") : "без знака"}
                                </span>
                                <label className="guide-label" htmlFor="guide-meaning">что он значит для тебя?</label>
                                <input
                                    id="guide-meaning"
                                    className="guide-input"
                                    value={meaning}
                                    onChange={(e) => setMeaning(e.target.value.slice(0, 120))}
                                    placeholder="одно-два слова"
                                    disabled={!sign}
                                />
                                <span className="guide-meta">это первое слово твоего словаря</span>
                                <button
                                    type="button"
                                    className={`guide-btn-text guide-nosign ${sign === null ? "is-on" : ""}`}
                                    onClick={() => pick(null)}
                                    aria-pressed={sign === null}
                                >
                                    без знака
                                </button>
                            </div>
                        </motion.div>
                        <motion.div className="guide-picker" variants={itemVariants} role="radiogroup" aria-label="выбрать другой знак">
                            {GLYPH_ORDER.map((key, i) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="radio"
                                    aria-checked={key === sign}
                                    aria-label={GLYPHS[key].tag}
                                    className={`guide-pick ${key === sign ? "is-on" : ""}`}
                                    onClick={() => pick(key)}
                                >
                                    <Glyph name={key} phase={i * 5} rate={0.7} className="guide-pick-glyph" />
                                </button>
                            ))}
                        </motion.div>
                        <motion.div className="guide-actions" variants={itemVariants}>
                            <button className="guide-btn-text" onClick={() => go("write")}>назад</button>
                            <button className="guide-btn" data-autofocus onClick={send}>отправить</button>
                        </motion.div>
                    </>
                );

            case "auth":
                return (
                    <motion.form className="guide-auth" ref={formRef} onSubmit={submitAuth} noValidate variants={itemVariants}>
                        <div className="guide-field">
                            <label className="guide-label" htmlFor="guide-login">идентификатор</label>
                            <input
                                id="guide-login"
                                className="guide-input"
                                value={login}
                                onChange={(e) => { setLogin(e.target.value); setLoginError(""); setAuthMsg(""); }}
                                autoComplete="username"
                                autoCapitalize="off"
                                spellCheck={false}
                                placeholder="..."
                                data-autofocus
                            />
                            <AnimatePresence>
                                {loginError && (
                                    <motion.span className="guide-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                        {loginError}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>
                        <div className="guide-field">
                            <label className="guide-label" htmlFor="guide-password">ключ доступа</label>
                            <div className="guide-password">
                                <input
                                    id="guide-password"
                                    className="guide-input"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setPasswordError(""); setAuthMsg(""); }}
                                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                                    placeholder="..."
                                />
                                <button type="button" className="guide-eye" onClick={() => setShowPassword((v) => !v)}>
                                    {showPassword ? "скрыть" : "показать"}
                                </button>
                            </div>
                            <AnimatePresence>
                                {passwordError && (
                                    <motion.span className="guide-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                        {passwordError}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>
                        {authMsg && <div className="guide-msg" role="alert">{authMsg}</div>}
                        <div className="guide-actions">
                            <button type="button" className="guide-btn-text" onClick={toggleMode}>
                                {mode === "register" ? "уже есть имя? войти" : "впервые? создать имя"}
                            </button>
                            <button type="submit" className="guide-btn" disabled={busy} aria-busy={busy}>
                                <AnimatePresence mode="popLayout" initial={false}>
                                    <motion.span
                                        key={busy ? "busy" : mode}
                                        initial={{ opacity: 0, x: 12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -12 }}
                                        transition={{ duration: 0.25, ease: EASE }}
                                    >
                                        {busy ? "синхронизация..." : mode === "register" ? "создать и выложить" : "войти и выложить"}
                                    </motion.span>
                                </AnimatePresence>
                            </button>
                        </div>
                    </motion.form>
                );

            case "publishing":
                return publishError ? (
                    <motion.div className="guide-actions" variants={itemVariants}>
                        <span />
                        <button className="guide-btn" data-autofocus onClick={() => { const id = safeLocalStorage.getItem("ID"); if (id) publish(id); }}>
                            ещё раз
                        </button>
                    </motion.div>
                ) : (
                    <motion.div className="guide-progress-line" variants={itemVariants} aria-hidden="true" />
                );

            case "done":
                return (
                    <>
                        <motion.article className="guide-card" ref={cardRef} variants={itemVariants}>
                            <span className="guide-card-num">#{String(result?.number || 1).padStart(3, "0")}</span>
                            <p className="guide-card-text">
                                {text.trim()}
                                {sign && <Glyph name={sign} className="guide-card-sign" />}
                            </p>
                            <div className="guide-card-foot">
                                <time>{GetPrettyTimePub({ date: result?.date || new Date() })}</time>
                                <span>на дереве</span>
                            </div>
                        </motion.article>
                        {granted && companion?.record && (
                            <motion.div className="guide-grant" variants={itemVariants}>
                                <div className="companion-tile guide-grant-tile">
                                    <Glyph name={granted} rate={1.2} className="companion-glyph" />
                                </div>
                                <div className="guide-grant-text">
                                    <span className="guide-label">первый компаньон</span>
                                    <span className="guide-grant-name">{CHARACTERS[granted].name}</span>
                                    <span className="guide-meta">
                                        {CHARACTERS[granted].trait} останется, пока ты заходишь. три дня без тебя — уйдёт:{" "}
                                        <Countdown to={deadline(companion.record)} />
                                    </span>
                                </div>
                            </motion.div>
                        )}
                        <motion.div className="guide-actions" variants={itemVariants}>
                            <button className="guide-btn-text" onClick={requestClose}>осмотреться</button>
                            <button className="guide-btn" data-autofocus onClick={startTour}>покажи, что где</button>
                        </motion.div>
                    </>
                );

            case "wait":
                return (
                    <motion.div className="guide-actions" variants={itemVariants}>
                        <button className="guide-btn-text" onClick={requestClose}>закрыть</button>
                        <button className="guide-btn" data-autofocus onClick={toProfile}>на мою страницу</button>
                    </motion.div>
                );

            case "wheel": {
                const rec = companion?.record ?? null;
                const owned = rec && isAlive(rec) ? rec.c : [];
                const spun = !canSpinToday(rec) && !wheel.spinning && !wheel.landed;
                return (
                    <>
                        <motion.div className="guide-wheel" variants={itemVariants}>
                            <Wheel
                                owned={owned}
                                target={wheel.target}
                                spinKey={wheel.spinKey}
                                landed={wheel.landed}
                                reduce={reduce}
                                onLand={onWheelLand}
                            />
                        </motion.div>
                        <motion.div className="guide-wheel-meta" variants={itemVariants}>
                            <span>компаньоны {owned.length}/{COLLECTIBLE.length}</span>
                            {rec && <span>серия {rec.s} дн.</span>}
                            {rec && owned.length > 0 && (
                                <span className="companion-danger">уйдут через <Countdown to={deadline(rec)} /></span>
                            )}
                        </motion.div>
                        <motion.div className="guide-actions" variants={itemVariants}>
                            {wheel.landed && wheel.landed !== "ktmz" ? (
                                <>
                                    <button className="guide-btn-text" onClick={requestClose}>спасибо</button>
                                    <button
                                        className="guide-btn"
                                        data-autofocus
                                        onClick={() => { playButtonSound(); navigate("/person"); setPhase("closing"); }}
                                    >
                                        к моей полке
                                    </button>
                                </>
                            ) : spun ? (
                                <>
                                    <span />
                                    <button className="guide-btn" data-autofocus onClick={requestClose}>до завтра</button>
                                </>
                            ) : (
                                <>
                                    <button className="guide-btn-text" onClick={requestClose} disabled={wheel.spinning}>потом</button>
                                    <button className="guide-btn" data-autofocus onClick={spinWheel} disabled={wheel.spinning}>
                                        {wheel.landed === "ktmz" ? "крутить ещё" : "крутить"}
                                    </button>
                                </>
                            )}
                        </motion.div>
                    </>
                );
            }

            default:
                return null;
        }
    };

    const overlay = (
        <>
            {windowShown && (
                <div className={`guide-overlay is-${phase}`}>
                    <div className="guide-veil" ref={veilRef} onClick={requestClose} />
                    <div
                        className="guide-window"
                        ref={windowRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="guide-speech"
                        onKeyDown={trapTab}
                    >
                        <div className="guide-topline" ref={toplineRef} />
                        <div className="guide-bolt" ref={boltRef} />
                        <div className="guide-frame" ref={frameRef}>
                            <div className="guide-inner">
                                <motion.div
                                    className="guide-sizer"
                                    initial={false}
                                    animate={{ height: contentHeight ?? "auto" }}
                                    transition={{ duration: phase === "open" ? 0.6 : 0, ease: EASE }}
                                    data-lenis-prevent
                                >
                                    <div className="guide-content" ref={contentRef}>
                                        <header className="guide-head">
                                            <span className="guide-tag">KTMZ.GUIDE</span>
                                            <span className="guide-progress" aria-hidden="true">
                                                <span style={{ transform: `scaleX(${STEP_INDEX[step] / 4})` }} />
                                            </span>
                                            <span className="guide-count">{step === "wheel" ? "КОЛЕСО" : `0${STEP_INDEX[step]}/04`}</span>
                                            <button className="guide-close" onClick={requestClose} aria-label="закрыть" disabled={busy || step === "publishing"}>
                                                &times;
                                            </button>
                                        </header>

                                        <div className="guide-stack">
                                            <AnimatePresence mode="popLayout">
                                                <motion.div
                                                    key={`${step}-${line}`}
                                                    variants={blockVariants}
                                                    initial="hidden"
                                                    animate={revealed ? "shown" : "hidden"}
                                                    exit="exit"
                                                >
                                                    <motion.div variants={itemVariants}>
                                                        <Speech id="guide-speech" text={line} active={revealed} instant={reduce} onSpeaking={onSpeaking} />
                                                    </motion.div>
                                                </motion.div>
                                            </AnimatePresence>
                                        </div>

                                        <AnimatePresence initial={false}>
                                            {showTicket && (
                                                <motion.div
                                                    key="ticket"
                                                    className="guide-ticket"
                                                    ref={ticketRef}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: revealed ? 1 : 0, y: 0 }}
                                                    exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
                                                    transition={{ duration: 0.5, ease: EASE }}
                                                >
                                                    <div className="guide-ticket-main">
                                                        <span className="guide-ticket-label">
                                                            запись · {step === "wait" ? "ждёт завтра" : step === "publishing" ? "в пути" : "черновик"}
                                                        </span>
                                                        <p className="guide-ticket-text">{text.trim()}</p>
                                                    </div>
                                                    <AnimatePresence mode="popLayout">
                                                        {sign && (signLanded || step !== "sign") && (
                                                            <motion.span
                                                                key={sign}
                                                                className="guide-ticket-sign-wrap"
                                                                initial={{ opacity: 0, scale: 1.6 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                exit={{ opacity: 0, scale: 0.6 }}
                                                                transition={{ duration: 0.45, ease: EASE }}
                                                            >
                                                                <Glyph name={sign} className="guide-ticket-sign" />
                                                            </motion.span>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="guide-stack">
                                            <AnimatePresence mode="popLayout">
                                                <motion.div
                                                    key={step}
                                                    className="guide-body"
                                                    variants={blockVariants}
                                                    initial="hidden"
                                                    animate={revealed ? "shown" : "hidden"}
                                                    exit="exit"
                                                >
                                                    {renderStep()}
                                                </motion.div>
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {catMounted && (
                <div
                    className={`guide-cat is-${phase} ${blend ? "is-blend" : ""}`}
                    ref={catRef}
                >
                    <button
                        className="guide-cat-hit"
                        onClick={purr}
                        onPointerEnter={() => { if (phase === "seated") { setHovering(true); boost(2.4, 400); } }}
                        onPointerLeave={() => setHovering(false)}
                        onFocus={() => phase === "seated" && setHovering(true)}
                        onBlur={() => setHovering(false)}
                        tabIndex={phase === "seated" ? 0 : -1}
                        aria-label={phase === "seated" && guest ? "кошка поможет с первой записью" : "погладить кошку"}
                    >
                        <span className="guide-cat-lean" ref={leanRef}>
                            <span className="guide-cat-squash" ref={squashRef}>
                                <span className="guide-cat-breath" ref={breathRef}>
                                    <Glyph name="ktmz" phase={49} rate={catRate} className="guide-cat-glyph" />
                                </span>
                            </span>
                        </span>
                    </button>
                </div>
            )}

            {(phase === "seated" || phase === "touring") && seatShown && (
                <div className="guide-bubble" ref={bubbleRef}>
                    <AnimatePresence>
                        {bubble && (
                            <motion.div
                                key={bubble.key}
                                className="guide-bubble-box"
                                initial={{ opacity: 0, scale: 0.92, y: 6 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.18 } }}
                                transition={{ duration: 0.45, ease: EASE }}
                            >
                                <Speech text={bubble.text} active instant={reduce} onSpeaking={(v) => onBubbleSpeaking(v, bubble)} />
                                {(bubble.actions || bubble.chatter) && (
                                    <div className="guide-bubble-actions">
                                        {bubble.chatter && (
                                            <button className="guide-bubble-quiet" onClick={quiet}>тише</button>
                                        )}
                                        {bubble.actions?.map((a) => (
                                            <button
                                                key={a.label}
                                                className={`guide-bubble-btn ${a.primary ? "is-primary" : ""}`}
                                                onClick={a.onClick}
                                            >
                                                {a.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </>
    );

    const contextValue = useMemo(() => ({ guest, openGuide, openWheel }), [guest, openGuide, openWheel]);

    return (
        <OnboardingContext.Provider value={contextValue}>
            {children}
            {createPortal(overlay, document.body)}
        </OnboardingContext.Provider>
    );
};

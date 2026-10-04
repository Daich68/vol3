import { safeLocalStorage } from "../../utils/localStorage";
import { GlyphKey } from "../Glyph/glyphs";

// "later" — closed the guide, the cat waits on the frame; "done" — the first note is on the tree
type GuideState = "later" | "done";

export type GuideDraft = {
    text: string;
    sign: GlyphKey | null;
    signPicked: boolean;
    meaning: string;
};

const STATE_KEY = "voltri.guide";
const DRAFT_KEY = "voltri.guideDraft";
const QUIET_KEY = "voltri.catQuiet";
const SEEN_KEY = "voltri.catSeen";

export const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const isGuest = (): boolean =>
    !(safeLocalStorage.getItem("accessToken") && safeLocalStorage.getItem("ID"));

export const getGuideState = (): GuideState | null =>
    safeLocalStorage.getItem(STATE_KEY) as GuideState | null;

export const setGuideState = (state: GuideState) => safeLocalStorage.setItem(STATE_KEY, state);

export const isHomePath = (pathname: string) => pathname === "/" || pathname === "/about";

// where the cat goes when the preloader curtain lifts: the guide for a first-time guest on the
// home page, her seat on the page frame for everyone else; the login page is the only place she avoids
export type CatDestination = "dialog" | "frame" | null;

export const catDestinationOnArrival = (pathname: string): CatDestination => {
    if (pathname.startsWith("/login")) return null;
    if (isGuest() && !getGuideState() && isHomePath(pathname)) return "dialog";
    return "frame";
};

const readJson = <T>(key: string): T | null => {
    const raw = safeLocalStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};

export const loadDraft = (): GuideDraft | null => readJson<GuideDraft>(DRAFT_KEY);

export const saveDraft = (draft: GuideDraft) => safeLocalStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

export const clearDraft = () => safeLocalStorage.removeItem(DRAFT_KEY);

export const isQuietToday = () => safeLocalStorage.getItem(QUIET_KEY) === todayKey();

export const setQuietToday = () => safeLocalStorage.setItem(QUIET_KEY, todayKey());

// the day she last saw this person — to say «с возвращением» only when it is true
export const lastSeen = () => safeLocalStorage.getItem(SEEN_KEY);

export const markSeen = () => safeLocalStorage.setItem(SEEN_KEY, todayKey());

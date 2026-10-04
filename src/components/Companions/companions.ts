import { DictEntry } from "../../entity/Entity";
import { GetDictByAuthorID, SaveDict } from "../../requests/Api";
import { GLYPH_ORDER, GlyphKey } from "../Glyph/glyphs";

// Companions: signs of the dictionary that stay with an author as long as the author keeps coming.
// The first one comes with the first note; then one spin of the wheel a day. Three days away
// (72 hours since the last visit) and every companion leaves.
//
// Stored where every profile can read it: a service entry in the author's own dictionary
// (gif_tag = COMPANION_TAG, meaning = JSON). The dictionary UI renders only the twelve sign tags,
// so the entry stays invisible there and survives dictionary edits.

export const COMPANION_TAG = ":vol3-companions:";
export const LOSS_MS = 72 * 60 * 60 * 1000;

export interface CompanionRecord {
    v: 1;
    /** companions, in the order they came */
    c: GlyphKey[];
    /** days in a row with a visit */
    s: number;
    /** last visit, ISO */
    l: string;
    /** day of the last wheel spin, YYYY-MM-DD */
    d: string;
}

// The cat introduces them by nicknames of her own; the cat herself is on the wheel too,
// and landing on her is a free spin
export const CHARACTERS: Record<GlyphKey, { name: string; trait: string }> = {
    ear: { name: "ухо", trait: "слушает всё и никому не пересказывает." },
    bliss: { name: "волна", trait: "приходит, уходит и ни о чём не жалеет." },
    p44: { name: "дом-44", trait: "у него окна горят до утра." },
    sad: { name: "спираль", trait: "думает по кругу, но каждый раз чуть глубже." },
    search: { name: "дозорный", trait: "ищет, даже когда искать нечего." },
    soul2: { name: "око", trait: "видит, что сегодня ещё ничего не написано." },
    tree: { name: "дерево", trait: "растёт медленно, как всё здесь." },
    ktmz: { name: "кошка", trait: "это я. я и так с тобой." },
    doom: { name: "пламя", trait: "горит тихо и долго." },
    temple: { name: "кров", trait: "укрывает недописанное." },
    fb: { name: "тень", trait: "ходит следом и не мешает." },
    bnd: { name: "двое", trait: "спорят, кто из них главный. уже лет сто." },
};

export const COLLECTIBLE: GlyphKey[] = GLYPH_ORDER.filter((k) => k !== "ktmz");

export const dayKey = (date: Date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const yesterdayKey = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dayKey(d);
};

export const isServiceEntry = (entry: DictEntry) => entry.gif_tag === COMPANION_TAG;

export const readRecord = (dict?: DictEntry[] | null): CompanionRecord | null => {
    const entry = dict?.find(isServiceEntry);
    if (!entry) return null;
    try {
        const r = JSON.parse(entry.meaning) as CompanionRecord;
        if (!Array.isArray(r.c) || typeof r.l !== "string") return null;
        return { v: 1, c: r.c.filter((k) => COLLECTIBLE.includes(k)), s: r.s || 0, l: r.l, d: r.d || "" };
    } catch {
        return null;
    }
};

export const deadline = (r: CompanionRecord) => Date.parse(r.l) + LOSS_MS;

export const isAlive = (r: CompanionRecord, now = Date.now()) => now <= deadline(r);

// what a visitor of the profile sees: nothing once the owner has been away for three days,
// even if the owner never comes back to clear it
export const visibleCompanions = (dict?: DictEntry[] | null): GlyphKey[] => {
    const r = readRecord(dict);
    return r && isAlive(r) ? r.c : [];
};

export const nextMidnight = () => {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
};

export const canSpinToday = (r: CompanionRecord | null) => !r || r.d !== dayKey();

export interface VisitResult {
    record: CompanionRecord | null;
    /** companions that left because of the three days away */
    lost: GlyphKey[];
    changed: boolean;
}

// a visit: either everything is gone (too long away), or the streak grows by a day
export const visit = (r: CompanionRecord | null, now = new Date()): VisitResult => {
    if (!r) return { record: null, lost: [], changed: false };
    if (!isAlive(r, now.getTime())) {
        return { record: { v: 1, c: [], s: 1, l: now.toISOString(), d: r.d }, lost: r.c, changed: true };
    }
    const lastDay = dayKey(new Date(r.l));
    if (lastDay === dayKey(now)) return { record: r, lost: [], changed: false };
    const s = lastDay === yesterdayKey() ? r.s + 1 : 1;
    return { record: { ...r, s, l: now.toISOString() }, lost: [], changed: true };
};

export const firstRecord = (key: GlyphKey): CompanionRecord => ({
    v: 1,
    c: [key],
    s: 1,
    l: new Date().toISOString(),
    d: dayKey(),
});

export const toEntry = (r: CompanionRecord): DictEntry => ({ gif_tag: COMPANION_TAG, meaning: JSON.stringify(r) });

// write the record into the author's dictionary without touching the author's words;
// `extra` lets the first note save its sign meaning in the same request
export async function saveRecord(authorId: string, record: CompanionRecord, extra: DictEntry[] = []) {
    const dicts = await GetDictByAuthorID(authorId);
    const current = dicts[0];
    const replaced = new Set([COMPANION_TAG, ...extra.map((e) => e.gif_tag)]);
    const entries = (current?.dict || []).filter((e) => !replaced.has(e.gif_tag));
    entries.push(...extra, toEntry(record));
    await SaveDict({ _id: current?._id, dict: entries, author_id: authorId });
    window.dispatchEvent(new CustomEvent("voltri:companions", { detail: { authorId, record } }));
}

export async function loadRecord(authorId: string): Promise<CompanionRecord | null> {
    const dicts = await GetDictByAuthorID(authorId);
    return readRecord(dicts[0]?.dict);
}

export const formatLeft = (ms: number) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

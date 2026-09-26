// The takes filmed by record.mjs. Each one is a little screenplay for the real
// app: what to open, how long to look, where to scroll, what to hover, click
// and type. Timings are in seconds of the take's own (virtual) clock.

const $nth = (sel, n) => `${sel}:nth-child(${n})`;

export const TAKES = {
  // Mobile: the real preloader, then the landing page top to bottom.
  "m-home": {
    device: "mobile",
    track: { indicator: ".custom-scroll-indicator" },
    async run(r) {
      await r.goto("/");
      await r.hold(6.2);
      await r.wheel(760, 1.4, { x: 210, y: 560 });
      await r.hold(1.2);
      await r.wheel(820, 1.4);
      await r.hold(1.8);
    },
  },

  // Desktop: the landing page's three stages with the custom scrollbar (the
  // branch fills with light, the node travels 20% → 50% → 80%), then the
  // branch navigation into the notes.
  "d-home": {
    device: "desktop",
    track: {
      indicator: ".custom-scroll-indicator",
      sidebar: ".page-frame-sidebar",
      notesBranch: '.branch[data-branch-id="notes"] .branch-content',
    },
    async run(r) {
      await r.goto("/", { preroll: 5.2 });
      await r.moveTo(760, 560, 0.01);
      await r.hold(1.6);
      await r.notch(880); // one wheel notch: Lenis glides, ScrollTrigger snaps to 50%
      await r.hold(2.4);
      await r.notch(820); // → 100%
      await r.hold(2.0);
      await r.moveOn('.branch[data-branch-id="notes"] .branch-content', 1.0);
      await r.hold(1.8);
      await r.click();
      await r.hold(2.4);
    },
  },

  // Desktop: the notes — scroll to the list, open a note (the one by Данила
  // Кудимов when real data is loaded) and read it to the end in reading mode,
  // where the scrollbar becomes a straight line.
  "d-notes": {
    device: "desktop",
    // The overlay's backdrop-filter makes it the containing block of the
    // position:fixed reading sidebar, so the progress scrolls away with the
    // text. Filmed as intended; the fix belongs in Notice.css.
    css: ".reading-overlay { backdrop-filter: none !important; }",
    track: {
      indicator: ".custom-scroll-indicator",
      readingIndicator: ".reading-sidebar .custom-scroll-indicator",
      readingSidebar: ".reading-sidebar",
      note: ".notice-item .notice-button",
    },
    async run(r) {
      await r.goto("/notes", { preroll: 5.2 });
      await r.moveTo(900, 520, 0.01);
      await r.hold(0.8);
      await r.wheel(640, 1.1);
      await r.hold(0.6);
      const n = await r.page.evaluate(() => {
        const items = [...document.querySelectorAll(".notice-item")];
        const i = items.findIndex((el) => /кудимов/i.test(el.textContent));
        return i < 0 ? 1 : i + 1;
      });
      r.trackSelectors.note = `${$nth(".notice-item", n)} .notice-button`;
      await r.moveOn(r.trackSelectors.note, 0.8);
      await r.hold(1.2);
      await r.click();
      await r.hold(1.3);
      await r.moveTo(980, 640, 0.4);
      await r.scrollEl(".reading-overlay", "end", 4.2);
      await r.hold(1.0);
    },
  },

  // Mobile: the personal dictionary — give three glyphs a meaning, save, write
  // a post with one of them, publish, and tap it to read the meaning back.
  "m-dict": {
    device: "mobile",
    scale: 3.75, // 1.5× the screen's resolution, for close-ups on the typing
    loggedIn: true,
    track: {
      dictList: ".dict-scroll-area",
      saveBtn: ".dict-save-btn",
      firstPost: ".post-card",
      postGlyph: ".post-card .gif-container",
    },
    async run(r) {
      await r.goto("/author/a0000000000000000000e5f7", { preroll: 5.4 });
      await r.hold(1.0);
      await r.tap($nth(".author-nav-item", 1)); // словарь
      await r.hold(1.0);
      await r.tap(`${$nth(".dict-premium-item", 1)} .dict-textarea`); // :gif-ear:
      await r.type("слушать и не отвечать", 15);
      await r.hold(0.5);
      await r.tap(`${$nth(".dict-premium-item", 2)} .dict-textarea`); // :gif-bliss:
      await r.type("тихая радость без причины", 15);
      await r.hold(0.4);
      await r.moveTo(216, 600, 0.2);
      await r.scrollEl(".dict-scroll-area", 700, 0.9);
      await r.tap(`${$nth(".dict-premium-item", 7)} .dict-textarea`); // :gif-tree:
      await r.type("рост, которого не видно", 15);
      await r.hold(0.6);
      await r.tap(".dict-save-btn"); // закрепить
      await r.hold(1.5);
      await r.tap($nth(".author-nav-item", 2)); // написать
      await r.hold(1.0);
      await r.tap("#post-textarea");
      await r.type("весь вечер слушал дождь", 15);
      await r.hold(0.3);
      await r.tap($nth(".gif-item-premium", 1), { hold: 1.4 }); // :gif-ear: + its meaning
      await r.hold(0.5);
      await r.tap(".dict-save-btn"); // опубликовать
      await r.hold(1.4);
      await r.moveTo(216, 620, 0.2);
      await r.wheel(640, 1.1);
      await r.hold(0.4);
      await r.tap(".post-card .gif-container", { hold: 2.4 });
    },
  },
};

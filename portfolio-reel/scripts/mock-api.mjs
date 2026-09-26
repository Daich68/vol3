// Stand-in for the production API while filming the app locally.
//
// By default it serves demo content in the voice of the project. If
// portfolio-reel/data/api.json exists (see fetch-api.mjs), the real notices,
// authors, posts and dictionaries from the site are served instead. Writes
// (saving a dictionary, publishing a post) only change this in-memory copy.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const realData = path.resolve(here, "../data/api.json");

// The recorder pins the page clock to this moment, so relative dates
// ("сегодня", "вчера") come out the same on every render. With real data it
// is the moment the data was fetched (the app hides anything "from the future").
const fetchedAt = fs.existsSync(realData) ? Date.parse(JSON.parse(fs.readFileSync(realData, "utf8")).fetched) : NaN;
export const EPOCH = Number.isFinite(fetchedAt) ? fetchedAt : Date.parse("2026-09-25T13:00:00+03:00");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days, hours = 0) => new Date(EPOCH - days * DAY - hours * 3600e3).toISOString();

const demoAuthors = [
  { _id: "a0000000000000000000a1f3", login: "tihiy.sad" },
  { _id: "a0000000000000000000b2c4", login: "lunnaya_mol" },
  { _id: "a0000000000000000000c3d5", login: "ekho" },
  { _id: "a0000000000000000000d4e6", login: "sever_kin" },
  { _id: "a0000000000000000000e5f7", login: "sadovnik" },
  { _id: "a0000000000000000000f6a8", login: "pyl_i_svet" },
  { _id: "a0000000000000000000a7b9", login: "morozno" },
];

export const HERO_AUTHOR = demoAuthors[0];
// The account that is "logged in" while filming the dictionary scene.
export const ME = demoAuthors[4];

const demoPosts = [
  { _id: "p01", author_id: HERO_AUTHOR._id, time_publication: ago(0, 2), text: "сегодня дерево за окном наконец отпустило последний лист :gif-tree: и стало видно, как много в нём было неба." },
  { _id: "p02", author_id: HERO_AUTHOR._id, time_publication: ago(1, 5), text: "один пост в день — как один глоток воды. не больше, но и не меньше :gif-bliss:" },
  { _id: "p03", author_id: HERO_AUTHOR._id, time_publication: ago(3, 1), text: "слушал дождь :gif-ear: весь вечер. он говорит на языке, которому нет словаря." },
  { _id: "p04", author_id: HERO_AUTHOR._id, time_publication: ago(6, 3), text: "понедельник :gif-doom: снова пришёл без приглашения." },
  { _id: "p05", author_id: HERO_AUTHOR._id, time_publication: ago(9, 7), text: "ищу :gif-search: не ответы, а правильные вопросы." },
  { _id: "p06", author_id: demoAuthors[1]._id, time_publication: ago(0, 6), text: "ночь как черновик." },
  { _id: "p07", author_id: demoAuthors[2]._id, time_publication: ago(1, 1), text: "эхо возвращается позже, чем кажется." },
  { _id: "p08", author_id: demoAuthors[3]._id, time_publication: ago(2, 4), text: "север — это направление мысли." },
  { _id: "p09", author_id: ME._id, time_publication: ago(2, 3), text: "посадил слово :gif-temple: жду всходов." },
  { _id: "p10", author_id: ME._id, time_publication: ago(5, 1), text: "в саду тихо. только ветер перелистывает прошлогодние листья." },
  { _id: "p11", author_id: demoAuthors[5]._id, time_publication: ago(5, 8), text: "пыль в луче света — самый честный танец." },
  { _id: "p12", author_id: demoAuthors[6]._id, time_publication: ago(12, 3), text: "морозно и ясно." },
];

const demoDicts = [{
  _id: "d01",
  author_id: HERO_AUTHOR._id,
  dict: [
    { gif_tag: ":gif-tree:", meaning: "рост, которого не видно" },
    { gif_tag: ":gif-bliss:", meaning: "тихая радость без причины" },
    { gif_tag: ":gif-ear:", meaning: "слушать и не отвечать" },
    { gif_tag: ":gif-doom:", meaning: "неизбежное утро понедельника" },
    { gif_tag: ":gif-search:", meaning: "поиск своего вопроса" },
  ],
}];

const para = (s) => `<p>${s}</p>`;
const head = (s) => `<h3>${s}</h3>`;
// The demo note is put together from the site's own copy (the philosophy
// page), so the reading mode shows the project's words rather than filler.
const demoNotices = [
  { _id: "n01", title: "электрическое дерево", author: "vol-3", time_publication: ago(0, 3),
    text_html: [
      para("вольтри — это не просто сеть. Это пространство, где каждое слово имеет вес."),
      para("Мы называем его «электрическим деревом»: как дерево растет медленно, так и ваши мысли здесь требуют времени и внимания."),
      para("Каждый импульс — это разряд, который остается в пространстве навсегда, формируя вашу историю и ваш собственный язык."),
      head("осознанность"),
      para("Каждое слово — это ваш выбор. Качество важнее количества."),
      head("размеренность"),
      para("Один пост в день — это ритм, который позволяет дышать."),
      head("самопознание"),
      para("Ваш словарик — это зеркало вашего внутреннего мира."),
      head("ограничения как свобода"),
      para("один пост в день — учит выбирать главное."),
      para("без редактирования — учит ответственности."),
      para("без удаления — создает честную историю."),
      head("путь"),
      para("используйте вольтри-язык, и просто оставайтесь здесь столько, сколько пожелаете."),
    ].join("") },
  { _id: "n02", title: "о медленном чтении", author: "редакция vol-3", time_publication: ago(2, 1), text_html: para("читать медленно — значит позволить тексту изменить темп вашего дыхания.") },
  { _id: "n03", title: "словарь как зеркало", author: "tihiy.sad", time_publication: ago(4, 6), text_html: para("личный словарь — это язык, которому вы учите сами себя.") },
  { _id: "n04", title: "письма без адресата", author: "lunnaya_mol", time_publication: ago(8, 2), text_html: para("иногда лучшее письмо — то, которое никто не прочтёт.") },
  { _id: "n05", title: "тишина между импульсами", author: "ekho", time_publication: ago(15, 4), text_html: para("пауза — тоже часть сообщения.") },
];

function initialState() {
  if (fs.existsSync(realData)) {
    const d = JSON.parse(fs.readFileSync(realData, "utf8"));
    return {
      real: true,
      notices: d.notices || [],
      authors: [...(d.authors || []), ...demoAuthors.filter((a) => a._id === ME._id)],
      posts: [...(d.posts || []), ...demoPosts.filter((p) => p.author_id === ME._id)],
      dicts: d.dictionaries || [],
    };
  }
  return { real: false, notices: demoNotices, authors: demoAuthors, posts: demoPosts, dicts: demoDicts };
}

const byTimeDesc = (a, b) => new Date(b.time_publication) - new Date(a.time_publication);

// One independent copy of the data per recording, so parallel takes don't
// see each other's saved dictionaries or posts.
export function createApi() {
  const state = initialState();
  function handle(method, urlString, bodyText) {
    const url = new URL(urlString);
    const p = url.pathname.replace(/\/+$/, "");
    const q = url.searchParams;
    if (method === "POST") {
      const body = bodyText ? JSON.parse(bodyText) : {};
      if (p.endsWith("/authenticated/dictionaries")) {
        state.dicts = state.dicts.filter((d) => d.author_id !== body.author_id);
        const saved = { ...body, _id: body._id || "d-saved" };
        state.dicts.push(saved);
        return { status: 200, body: saved };
      }
      if (p.endsWith("/authenticated/posts")) {
        const saved = { ...body, _id: `p${state.posts.length + 100}` };
        state.posts.push(saved);
        return { status: 200, body: saved };
      }
      if (p.endsWith("/login") || p.endsWith("/reg")) {
        return { status: 200, body: { access: "demo", _id: ME._id, login: ME.login, roles: "" } };
      }
      return null;
    }
    if (p.endsWith("/notice")) return { status: 200, body: state.notices };
    if (p.endsWith("/authors")) {
      const id = q.get("id");
      return { status: 200, body: id ? state.authors.filter((a) => a._id === id) : state.authors };
    }
    if (p.endsWith("/posts")) {
      const id = q.get("author_id");
      return { status: 200, body: (id ? state.posts.filter((x) => x.author_id === id) : state.posts).slice().sort(byTimeDesc) };
    }
    if (p.endsWith("/dictionaries")) {
      return { status: 200, body: state.dicts.filter((d) => d.author_id === q.get("author_id")) };
    }
    return null;
  }
  return { handle, real: state.real };
}

export const usingRealData = () => fs.existsSync(realData);

// For capture-screens.mjs (GET only, one shared copy of the data).
const shared = createApi();
export function mockResponse(urlString) {
  const r = shared.handle("GET", urlString);
  return r ? r.body : null;
}

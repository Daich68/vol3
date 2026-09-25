// Demo content for capturing the data-driven pages (notes, search, author)
// without the production API. Everything here is placeholder copy written in
// the voice of the project.

const DAY = 24 * 60 * 60 * 1000;
const ago = (days, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600e3).toISOString();

export const authors = [
  { _id: "a0000000000000000000a1f3", login: "tihiy.sad" },
  { _id: "a0000000000000000000b2c4", login: "lunnaya_mol" },
  { _id: "a0000000000000000000c3d5", login: "ekho" },
  { _id: "a0000000000000000000d4e6", login: "sever_kin" },
  { _id: "a0000000000000000000e5f7", login: "sadovnik" },
  { _id: "a0000000000000000000f6a8", login: "pyl_i_svet" },
  { _id: "a0000000000000000000a7b9", login: "morozno" },
  { _id: "a0000000000000000000b8ca", login: "voltri_bot" },
];

export const HERO_AUTHOR = authors[0];

export const posts = [
  { _id: "p01", author_id: HERO_AUTHOR._id, time_publication: ago(0, 2),
    text: "сегодня дерево за окном наконец отпустило последний лист :gif-tree: и стало видно, как много в нём было неба." },
  { _id: "p02", author_id: HERO_AUTHOR._id, time_publication: ago(1, 5),
    text: "один пост в день — как один глоток воды. не больше, но и не меньше :gif-bliss:" },
  { _id: "p03", author_id: HERO_AUTHOR._id, time_publication: ago(3, 1),
    text: "слушал дождь :gif-ear: весь вечер. он говорит на языке, которому нет словаря." },
  { _id: "p04", author_id: HERO_AUTHOR._id, time_publication: ago(6, 3),
    text: "понедельник :gif-doom: снова пришёл без приглашения." },
  { _id: "p05", author_id: HERO_AUTHOR._id, time_publication: ago(9, 7),
    text: "ищу :gif-search: не ответы, а правильные вопросы." },
  { _id: "p06", author_id: authors[1]._id, time_publication: ago(0, 6), text: "ночь как черновик." },
  { _id: "p07", author_id: authors[2]._id, time_publication: ago(1, 1), text: "эхо возвращается позже, чем кажется." },
  { _id: "p08", author_id: authors[3]._id, time_publication: ago(2, 4), text: "север — это направление мысли." },
  { _id: "p09", author_id: authors[4]._id, time_publication: ago(4, 2), text: "посадил слово, жду всходов." },
  { _id: "p10", author_id: authors[5]._id, time_publication: ago(5, 8), text: "пыль в луче света — самый честный танец." },
  { _id: "p11", author_id: authors[6]._id, time_publication: ago(12, 3), text: "морозно и ясно." },
];

export const dict = [{
  _id: "d01",
  author_id: HERO_AUTHOR._id,
  dict: [
    { gif_tag: ":gif-tree:", meaning: "рост, которого не видно" },
    { gif_tag: ":gif-bliss:", meaning: "тихая радость без причины" },
    { gif_tag: ":gif-ear:", meaning: "слушать и не отвечать" },
    { gif_tag: ":gif-doom:", meaning: "неизбежное утро понедельника" },
    { gif_tag: ":gif-search:", meaning: "поиск своего вопроса" },
    { gif_tag: ":gif-sad:", meaning: "осенняя усталость" },
    { gif_tag: ":gif-soul2:", meaning: "внутренний огонь" },
    { gif_tag: ":gif-temple:", meaning: "место силы" },
  ],
}];

const para = (s) => `<p>${s}</p>`;
export const notices = [
  { _id: "n01", title: "электрическое дерево", author: "редакция vol-3", time_publication: ago(0, 3),
    text_html: [
      "вольтри — это не лента и не поток. это дерево, которое растёт медленно: одна ветвь в день.",
      "каждое слово здесь — импульс. он проходит по стволу, остаётся в коре и становится частью общей истории.",
      "мы не редактируем и не удаляем. мы учимся выбирать главное.",
    ].map(para).join("") },
  { _id: "n02", title: "о медленном чтении", author: "редакция vol-3", time_publication: ago(2, 1),
    text_html: para("читать медленно — значит позволить тексту изменить темп вашего дыхания.") },
  { _id: "n03", title: "словарь как зеркало", author: "tihiy.sad", time_publication: ago(4, 6),
    text_html: para("личный словарь — это язык, которому вы учите сами себя.") },
  { _id: "n04", title: "письма без адресата", author: "lunnaya_mol", time_publication: ago(8, 2),
    text_html: para("иногда лучшее письмо — то, которое никто не прочтёт.") },
  { _id: "n05", title: "тишина между импульсами", author: "ekho", time_publication: ago(15, 4),
    text_html: para("пауза — тоже часть сообщения.") },
];

// Resolves an API request URL to a JSON body (or null to let it 404).
export function mockResponse(urlString) {
  const url = new URL(urlString);
  const p = url.pathname.replace(/\/+$/, "");
  const q = url.searchParams;
  if (p.endsWith("/notice")) return notices;
  if (p.endsWith("/authors")) {
    const id = q.get("id");
    return id ? authors.filter((a) => a._id === id) : authors;
  }
  if (p.endsWith("/posts")) {
    const id = q.get("author_id");
    return id ? posts.filter((x) => x.author_id === id) : posts;
  }
  if (p.endsWith("/dictionaries")) {
    const id = q.get("author_id");
    return dict.filter((d) => d.author_id === id);
  }
  return null;
}

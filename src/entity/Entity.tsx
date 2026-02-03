export type Credits = {
    login: string,
    password: string,
}

export type Token = {
    access: string,
    _id: string,
    login: string,
    roles: string,
}

export type Author = {
    _id: string,
    login: string,
}

export type Notice = {
    _id: string,
    text_html: string,
    time_publication: Date,
    author: string,
    title: string,
}

export type Post = {
    _id?: string,
    text: string,
    time_publication: Date,
    author_id: string,
}

export type Dict = {
    _id?: string,
    dict: DictEntry[],
    author_id: string,
}

export type DictEntry = {
    gif_tag: string;
    meaning: string;
};
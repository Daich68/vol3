import {Author, Dict, Notice, Post} from "../entity/Entity";
import {URLs} from "../entity/constants/Urls";
import {editEntity, getEntity, getEntityWithQueryParams} from "../utils/ReqestEntityUtils";


export function GetAuthors(): Promise<Author[]> {
    return getEntity(URLs.GetAuthors)
}

export function GetAuthorByID(id: string): Promise<Author[]> {
    return getEntity(URLs.GetAuthors,id)
}


export async function GetNotices(): Promise<Notice[]> {
    // return getEntity(URLs.GetNotices)
    const notice = await getEntity<Notice[]>(URLs.GetNotices);
    return notice.filter(n => new Date(n.time_publication) <= new Date());
}


export async function GetPostsByAuthorID(id: string): Promise<Post[]> {
    const posts = await getEntityWithQueryParams<Post[]>(URLs.GetPosts, {"author_id": id})
    return posts.filter(post => new Date(post.time_publication) <= new Date());
}

export async function GetPosts(): Promise<Post[]> {
    const posts = await getEntity<Post[]>(URLs.GetPosts);
    return posts.filter(post => new Date(post.time_publication) <= new Date());
}


export function SendPost(p:Post) {
    return editEntity(URLs.PostPosts, p)
}

export function GetDictByAuthorID(id: string): Promise<Dict[]> {
    return getEntityWithQueryParams(URLs.GetDict, {"author_id": id})
}

export function SaveDict(d: Dict) {
    return editEntity(URLs.PostDict,d )
}
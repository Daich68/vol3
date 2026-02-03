const BaseUrl: string = "https://vol3.web-almanac.com";
const auth: string = "/authenticated"
export const URLs = {
    Login: BaseUrl + "/login",
    Reg: BaseUrl + "/reg",
    GetNotices: BaseUrl + "/notice",
    GetAuthors: BaseUrl + "/authors",
    GetPosts: BaseUrl + "/posts",
    PostPosts: BaseUrl + auth + "/posts",
    GetDict: BaseUrl + "/dictionaries",
    PostDict: BaseUrl + auth +"/dictionaries",
};

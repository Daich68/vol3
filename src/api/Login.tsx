import {getEntityWithParams} from "../utils/ReqestEntityUtils";
import {Credits, Token} from "../entity/Entity";
import {URLs} from "../entity/constants/Urls";

export function loginRequest(data: Credits): Promise<Token> {
    return getEntityWithParams<Token, Credits>(URLs.Login, data);
}

export function regRequest(data: Credits): Promise<Token> {
    return getEntityWithParams<Token, Credits>(URLs.Reg, data);
}
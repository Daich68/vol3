import ear from "../../static/icons/ear.gif";
import bliss from "../../static/icons/bliss.gif";
import p44 from "../../static/icons/p-44.gif";
import sad from "../../static/icons/sad.gif";
import search from "../../static/icons/search.gif";
import soul2 from "../../static/icons/soul-2.gif";
import tree from "../../static/icons/tree.gif";
import ktmz from "../../static/icons/ktmz.gif";
import doom from "../../static/icons/doom.gif";
import temple from "../../static/icons/temple.gif";
import fb from "../../static/icons/fb.gif";
import bnd from "../../static/icons/bnd.gif";
import {DictEntry} from "../../entity/Entity";

export const Gifs = [
    { tag: ":gif-ear:", src: ear, alt: "Ear GIF" },
    { tag: ":gif-bliss:", src: bliss, alt: "Bliss GIF" },
    { tag: ":gif-p-44:", src: p44, alt: "P-44 GIF" },
    { tag: ":gif-sad:", src: sad, alt: "Sad GIF" },
    { tag: ":gif-search:", src: search, alt: "Search GIF" },
    { tag: ":gif-soul2:", src: soul2, alt: "soul2 GIF" },
    { tag: ":gif-tree:", src: tree, alt: "tree GIF" },
    { tag: ":gif-ktmz:", src: ktmz, alt: "ktmz GIF" },
    { tag: ":gif-doom:", src: doom, alt: "doom GIF" },
    { tag: ":gif-temple:", src: temple, alt: "temple GIF" },
    { tag: ":gif-fb:", src: fb, alt: "fb GIF" },
    { tag: ":gif-bnd:", src: bnd, alt: "bnd GIF" },
];

export const DisplayGif = (text: string) => {
    let updatedText = text;
    Gifs.forEach((gif) => {
        const regex = new RegExp(gif.tag, "g");
        updatedText = updatedText.replace(
            regex,
            `<img style="width: 8rem" src="${gif.src}" alt="${gif.alt}" class="gif-image"/>`
        );
    });
    return updatedText;
};

export const DisplayGifWithMean = (text: string, dict: DictEntry[]) => {
    let updatedText = text;
    Gifs.forEach((gif) => {
        const entry = dict.find((entry) => entry.gif_tag === gif.tag);

        const regex = new RegExp(gif.tag, "g");
        updatedText = updatedText.replace(
            regex,
            `<span class="gif-container">
                  <img style="width: 8rem" src="${gif.src}" alt="${gif.alt}" class="gif-image"/>
                <span class="gif-tooltip">${entry?.meaning || "?"}</span>
            </span>`
        );
    });
    return updatedText;
};

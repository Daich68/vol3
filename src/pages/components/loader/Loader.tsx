import React from "react";
import "./Loader.css"
import sad from "../../../static/icons/sad.gif";


export const Loader: React.FC = () => {
    return (
        <div className={"loader"}>
            <div className={"container"}>
                <img src={sad} alt="GIF" className="gif-image" />
            </div>
        </div>
    );
};
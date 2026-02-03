import React, { useState} from "react";
import ear from "../../../static/icons/ear.gif";
import bliss from "../../../static/icons/bliss.gif";
import tree from "../../../static/icons/tree.gif";
import useSound from "use-sound";
// @ts-ignore
import vol3wav from "../../../static/sound/vol3.wav"
// @ts-ignore
import button from "../../../static/sound/button.wav"
import "./Header.css"
import {Link} from "react-router-dom";


export const Header: React.FC = () => {
    const [play, { stop }] = useSound(vol3wav, { volume: 0.5, loop: true });
    const [playB] = useSound(button, { volume: 2, loop: false });
    const[isPlaying, setIsPlaying] = useState(false)
    
    const handleToggleSound = () => {
        if (isPlaying) {
            stop();
            setIsPlaying(false)
        } else {
            playB()
            play();
            setIsPlaying(true)
        }
    };

    const handleButtonSound = ()=> {
        playB();
    };

    return(
        <div className={"menu"} role="navigation" aria-label="Главное меню">
            <div className={"container-icons"}>
                <Link 
                    to={"/"} 
                    aria-label="На главную" 
                    title="На главную"
                > 
                    <div className={"menu-icon"} onClick={handleButtonSound}>
                        <img src={tree} alt="" className="gif-image" aria-hidden="true"/>
                    </div>
                </Link>
                <button 
                    className={"menu-icon"} 
                    onClick={handleToggleSound}
                    aria-label={isPlaying ? "Выключить музыку" : "Включить музыку"}
                    aria-pressed={isPlaying}
                    title={isPlaying ? "Выключить музыку" : "Включить музыку"}
                >
                    <img src={isPlaying ? ear : bliss} alt="" className="gif-image" aria-hidden="true"/>
                </button>
            </div>
            <hr/>
        </div>
    )
}
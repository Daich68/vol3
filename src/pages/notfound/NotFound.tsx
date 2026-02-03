import React from "react";
import "./NotFound.css";
import { ScrollProgress } from "../../components/ScrollProgress/ScrollProgress";

export const NotFound: React.FC = () => {

    return (
        <div className="notfound">
            <ScrollProgress />
            <h3>страница не найдена</h3>
        </div>
    );
};

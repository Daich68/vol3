import React, { useEffect, useState } from "react";
import { GetNotices } from "../../requests/Api";
import { Notice } from "../../entity/Entity";
import "./Notice.css";
import { Loader } from "../components/loader/Loader";
import { GetPrettyTimePub } from "../../utils/DatetimeUtils";
import { ScrollProgress } from "../../components/ScrollProgress/ScrollProgress";

export const NoticePage: React.FC = () => {
    const [notices, setNotices] = useState<Notice[]>();
    const [visibleNotices, setVisibleNotices] = useState<{ [key: number]: boolean }>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        const fetchNotices = async () => {
            setIsLoading(true);
            setError("");
            
            try {
                const data = await GetNotices();
                setNotices(data);
            } catch (error) {
                console.error(error);
                setError("не удалось загрузить заметки. попробуйте обновить страницу");
            } finally {
                setIsLoading(false);
            }
        };

        fetchNotices();
    }, []);

    const toggleVisibility = (index: number) => {
        setVisibleNotices((prev) => ({
            ...prev,
            [index]: !prev[index],
        }));
    };

    const handleKeyPress = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleVisibility(index);
        }
    };

    if (isLoading) {
        return <Loader />;
    }

    if (error) {
        return (
            <div className="notice">
                <div className="error-state" role="alert">
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!notices || notices.length === 0) {
        return (
            <div className="notice">
                <h3>notes - это журнал внутри вольтри; notes - это статьи, эссе, работы, заметки о вебе;</h3>
                <div className="empty-state">
                    <p>пока нет заметок</p>
                </div>
            </div>
        );
    }

    return (
        <div className="notice">
            <ScrollProgress />
            <h3>notes - это журнал внутри вольтри; notes - это статьи, эссе, работы, заметки о вебе;</h3>
            {notices.map((n: Notice, index: number) => {
                const isExpanded = visibleNotices[index];
                
                return (
                    <article key={index} className="notice-item">
                        <button
                            onClick={() => toggleVisibility(index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            className="notice-header"
                            aria-expanded={isExpanded}
                            aria-controls={`notice-content-${index}`}
                        >
                            <span className="notice-title">
                                <span className="expand-icon" aria-hidden="true">
                                    {isExpanded ? "▼" : "▶"}
                                </span>
                                {" "}
                                {n.author} - {n.title}
                            </span>
                            <time 
                                className="time-publication"
                                dateTime={new Date(n.time_publication).toISOString()}
                            >
                                {GetPrettyTimePub({ date: new Date(n.time_publication) })}
                            </time>
                        </button>
                        {isExpanded && (
                            <div 
                                id={`notice-content-${index}`}
                                className="notice-content"
                                dangerouslySetInnerHTML={{ __html: n.text_html }}
                            />
                        )}
                    </article>
                );
            })}
        </div>
    );
};

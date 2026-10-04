import React, { useEffect, useState } from "react";
import { formatLeft } from "./companions";

// hh:mm:ss to a moment, ticking every second
export const Countdown: React.FC<{ to: number; className?: string }> = ({ to, className = "" }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    return <span className={`companion-countdown ${className}`}>{formatLeft(to - now)}</span>;
};

import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { safeLocalStorage } from "../../utils/localStorage";
import { Loader } from "../components/loader/Loader";

export const AuthRedirect = ({ id }: { id: string | null }) => {
    const [userId, setUserId] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkAuth = () => {
            let finalId = id;
            
            if (!finalId) {
                finalId = safeLocalStorage.getItem("ID");
            }
            
            setUserId(finalId);
            setIsChecking(false);
        };

        checkAuth();
    }, [id]);

    if (isChecking) {
        return <Loader />;
    }

    if (!userId) {
        return <Navigate to="/login" replace />;
    }
    
    return <Navigate to={`/author/${userId}`} replace />;
};

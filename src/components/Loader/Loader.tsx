import React from 'react';
import './Loader.css';

export const Loader: React.FC = () => {
    return (
        <div className="loader-container">
            <div className="loader-content">
                <div className="loader-circle" />
                <div className="loader-text">vol_loading...</div>
            </div>
        </div>
    );
};

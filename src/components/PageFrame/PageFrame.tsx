import React, { useRef } from 'react';
import './PageFrame.css';
import { ScrollProgress } from '../ScrollProgress/ScrollProgress';
import { InteractiveObject } from '../InteractiveObject/InteractiveObject';

interface PageFrameProps {
    children: React.ReactNode;
    showScroll?: boolean;
}

export const PageFrame: React.FC<PageFrameProps> = ({ children, showScroll = true }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    return (
        <div className="page-frame-container">
            <div className="page-frame-layout">
                <div className="page-frame-inner-border">
                    <div className="page-frame-content" ref={contentRef}>
                        <div className="content-wrapper">
                            {children}
                        </div>
                    </div>

                    {/* Interactive Objects in corners */}
                    <InteractiveObject position="bottom-right" />
                    <InteractiveObject position="top-left" />

                    {/* Right Sidebar with Scrollbar */}
                    <div className="page-frame-sidebar">
                        {showScroll && <ScrollProgress containerRef={contentRef} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

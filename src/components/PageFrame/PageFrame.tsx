import React, { useRef, useEffect } from 'react';
import './PageFrame.css';
import { ScrollProgress } from '../ScrollProgress/ScrollProgress';
import { InteractiveObject } from '../InteractiveObject/InteractiveObject';
import { LiquidBackground } from '../LiquidBackground/LiquidBackground';
import { useLenis } from '../../hooks/useLenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface PageFrameProps {
    children: React.ReactNode;
    showScroll?: boolean;
}

export const PageFrame: React.FC<PageFrameProps> = ({ children, showScroll = true }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    // Initialize Lenis for the scrollable content area
    useLenis(contentRef);

    useEffect(() => {
        if (contentRef.current) {
            // Tell ScrollTrigger to use our custom scroll container
            ScrollTrigger.defaults({
                scroller: contentRef.current
            });

            // Re-refresh ScrollTrigger when content changes
            ScrollTrigger.refresh();
        }
    }, [children]);

    return (
        <div className="page-frame-container">
            {/* Liquid Interactive Background */}
            <LiquidBackground />

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

import React, { useEffect } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';
import './LiquidBackground.css';

export const LiquidBackground: React.FC = () => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const springConfig = { damping: 40, stiffness: 150, mass: 1 };

    // Multiple interactive blobs with different spring behaviors for "trailing" effect
    const blob1X = useSpring(mouseX, springConfig);
    const blob1Y = useSpring(mouseY, springConfig);

    const blob2X = useSpring(mouseX, { ...springConfig, damping: 60, stiffness: 120 });
    const blob2Y = useSpring(mouseY, { ...springConfig, damping: 60, stiffness: 120 });

    const blob3X = useSpring(mouseX, { ...springConfig, damping: 80, stiffness: 90 });
    const blob3Y = useSpring(mouseY, { ...springConfig, damping: 80, stiffness: 90 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mouseX.set(e.clientX);
            mouseY.set(e.clientY);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [mouseX, mouseY]);

    return (
        <div className="liquid-bg-container">
            {/* SVG Filter for Gooey Effect */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <filter id="goo">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="40" result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 80 -25"
                            result="goo"
                        />
                        <feComposite in="SourceAtop" in2="goo" operator="atop" />
                    </filter>
                </defs>
            </svg>

            <div className="liquid-bg-wrapper">
                {/* Fixed background structures */}
                <div className="blob blob-main-bg" />

                {/* Floating autonomous blobs */}
                <div className="blob float-blob-1" />
                <div className="blob float-blob-2" />
                <div className="blob float-blob-3" />

                {/* Interactive blobs that follow mouse with trailing */}
                <motion.div
                    className="blob blob-interactive-1"
                    style={{ x: blob1X, y: blob1Y, translateX: '-50%', translateY: '-50%' }}
                />
                <motion.div
                    className="blob blob-interactive-2"
                    style={{ x: blob2X, y: blob2Y, translateX: '-50%', translateY: '-50%' }}
                />
                <motion.div
                    className="blob blob-interactive-3"
                    style={{ x: blob3X, y: blob3Y, translateX: '-50%', translateY: '-50%' }}
                />
            </div>

            {/* Subtle grain texture for depth */}
            <div className="grain-overlay" />
        </div>
    );
};

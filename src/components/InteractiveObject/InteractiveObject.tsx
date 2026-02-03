import React, { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import './InteractiveObject.css';

interface InteractiveObjectProps {
    position?: 'bottom-right' | 'top-left';
}

export const InteractiveObject: React.FC<InteractiveObjectProps> = ({ position = 'bottom-right' }) => {
    const ref = useRef<HTMLDivElement>(null);

    // Motion values for mouse position
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const springConfig = { damping: 20, stiffness: 100, mass: 0.5 };

    // Physics Logic
    const rotateX = useSpring(useTransform(y, [-100, 100], [-15, 15]), springConfig);
    const rotateY = useSpring(useTransform(x, [-100, 100], [15, -15]), springConfig);

    // Glare movement
    const glareX = useSpring(useTransform(x, [-100, 100], [0, 100]), springConfig);
    const glareY = useSpring(useTransform(y, [-100, 100], [0, 100]), springConfig);

    useEffect(() => {
        const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
            if (!ref.current) return;

            const rect = ref.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Check if mouse is over the element
            const isOver = e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom;

            if (isOver) {
                const offsetX = e.clientX - centerX;
                const offsetY = e.clientY - centerY;

                x.set(offsetX * 1.5);
                y.set(offsetY * 1.5);
            } else {
                // Reset when not hovering
                x.set(0);
                y.set(0);
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
        };
    }, [x, y]);

    return (
        <div
            className={`interactive-object-container ${position}`}
            style={{ perspective: 1000 }}
        >
            <motion.div
                ref={ref}
                className="interactive-object-card"
                style={{
                    rotateX,
                    rotateY,
                    transformStyle: 'preserve-3d'
                }}
            >
                {/* The Image Object */}
                <img
                    src="/01.png"
                    alt="Interactive Object"
                    className="interactive-image"
                    draggable={false}
                />

                {/* Glare/Sheen Effect */}
                <motion.div
                    className="interactive-glare"
                    style={{
                        background: `radial-gradient(
                            circle at ${glareX}% ${glareY}%, 
                            rgba(255,255,255,0.6) 0%, 
                            rgba(255,255,255,0) 60%
                        )`,
                        opacity: useTransform(x, (val) => Math.abs(val) > 2 ? 1 : 0)
                    }}
                />
            </motion.div>
        </div>
    );
};

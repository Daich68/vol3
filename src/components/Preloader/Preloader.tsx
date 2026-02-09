import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import './Preloader.css';

interface PreloaderProps {
    onComplete: () => void;
    onStartExit?: () => void;
}

export const Preloader: React.FC<PreloaderProps> = ({ onComplete, onStartExit }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLImageElement>(null);
    const scrollRef = useRef<HTMLImageElement>(null);
    const counterRef = useRef<HTMLDivElement>(null);

    // State to track if we've already started the exit sequence to prevent double-firing
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        // 1. Minimum display time promise (3s for effect)
        const minTimePromise = new Promise<void>((resolve) => {
            setTimeout(resolve, 3000);
        });

        // 2. Window load promise
        const loadPromise = new Promise<void>((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                const handler = () => {
                    resolve();
                    window.removeEventListener('load', handler);
                };
                window.addEventListener('load', handler);
            }
        });

        // 3. Fallback promise (5s max)
        const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(resolve, 5000);
        });

        // Wait for (load OR timeout) AND minTime
        Promise.all([
            Promise.race([loadPromise, timeoutPromise]),
            minTimePromise
        ]).then(() => {
            if (isExiting) return;
            setIsExiting(true);

            // Notify parent that exit animation is starting
            if (onStartExit) onStartExit();

            // Exit Animation Timeline
            const tl = gsap.timeline({
                onComplete: onComplete
            });

            // 1. Fade out details
            tl.to([counterRef.current, ".preloader-meta", ".preloader-scroll-container", ".preloader-bg-pattern", ".preloader-circle-wrapper"], {
                opacity: 0,
                y: -20,
                duration: 0.5,
                stagger: 0.05,
                ease: "power2.in"
            })
                // 2. Scale Logo massively and blur
                .to(logoRef.current, {
                    scale: 20,
                    opacity: 0,
                    filter: "blur(20px)",
                    duration: 1.2,
                    ease: "expo.inOut" // Smooth acceleration
                }, "-=0.2")
                // 3. Reveal Content (Swipe Up)
                .to(containerRef.current, {
                    clipPath: "inset(0% 0% 100% 0%)",
                    duration: 1,
                    ease: "power4.inOut"
                }, "-=0.9");
        });
    }, [onComplete, isExiting, onStartExit]);

    // Entrance & Loop Animations
    useEffect(() => {
        const tl = gsap.timeline();

        // --- Circular Diagram Animation ---
        const baseCircle = document.querySelector(".progress-ring__base-circle");
        const fillCircle = document.querySelector(".progress-ring__fill-circle");

        if (baseCircle && fillCircle) {
            gsap.set([baseCircle, fillCircle], {
                scale: 0.95,
                opacity: 0,
                rotate: -90,
                "--fill-angle": "0deg"
            });

            gsap.to(baseCircle, {
                opacity: 0.03,
                scale: 1,
                duration: 2,
                ease: "expo.out"
            });

            gsap.to(fillCircle, {
                opacity: 0.8,
                scale: 1,
                duration: 2,
                ease: "expo.out",
                delay: 0.5
            });

            // Progressive Fill - Smoother and lighter
            gsap.to(fillCircle, {
                "--fill-angle": "360deg",
                duration: 4.5,
                ease: "power2.inOut",
            });

            // Extreme Minimalist Rotation
            gsap.to([baseCircle, fillCircle], {
                rotate: 30, // Just a tiny nudge of rotation
                duration: 10,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
            });

            // Minimalist "Breathing" Glow - Neutral White
            gsap.to(fillCircle, {
                filter: "invert(0.1) drop-shadow(0 0 12px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 6px rgba(255, 255, 255, 0.4))",
                duration: 3,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
            });
        }

        // --- Logo Animation Refinement ---
        if (logoRef.current) {
            // Initial Entrance
            gsap.fromTo(logoRef.current,
                { opacity: 0, y: 20, scale: 0.9, filter: "blur(10px)" },
                { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 2, ease: "expo.out" }
            );

            // Subtle Glitch/Pulse effect
            const logoTimeline = gsap.timeline({ repeat: -1, repeatDelay: 4 });
            logoTimeline
                .to(logoRef.current, { scale: 1.05, duration: 0.1, ease: "power4.in" })
                .to(logoRef.current, { scale: 1, duration: 0.4, ease: "elastic.out(1, 0.3)" })
                .to(logoRef.current, { opacity: 0.7, x: -2, duration: 0.05 })
                .to(logoRef.current, { opacity: 1, x: 0, duration: 0.05 });
        }

        // Counter Simulation
        let counterObj = { val: 0 };
        gsap.to(counterObj, {
            val: 100,
            duration: 3,
            ease: "expo.out",
            onUpdate: () => {
                if (counterRef.current) {
                    counterRef.current.innerText = Math.floor(counterObj.val).toString().padStart(3, '0');
                }
            }
        });

        // Background Pattern Float
        gsap.to(".preloader-bg-pattern", {
            backgroundPosition: "100px 100px",
            duration: 20,
            repeat: -1,
            ease: "none"
        });

        // Footer Elements Entrance
        tl.from([".preloader-meta", counterRef.current, ".preloader-scroll-container"], {
            opacity: 0,
            y: 20,
            stagger: 0.2,
            duration: 1,
            ease: "power2.out"
        }, "-=1");

    }, []);

    return (
        <div className="preloader" ref={containerRef}>
            <div className="preloader-bg-pattern" />

            <div className="preloader-content">
                <div className="preloader-center-stage">

                    {/* Custom Integrated Circle Diagram */}
                    <div className="preloader-circle-wrapper">
                        {/* Base Layer (Faint Static Reference) */}
                        <img
                            src="/circle.svg"
                            className="progress-ring__base-circle"
                            alt=""
                        />
                        {/* Interactive Fill Layer (Glow + Progress) */}
                        <img
                            src="/circle.svg"
                            className="progress-ring__fill-circle"
                            alt=""
                        />
                    </div>

                    <div className="preloader-logo-container">
                        <img
                            src="/logo [Vectorized].svg"
                            alt="Voltri"
                            className="preloader-logo"
                            ref={logoRef}
                        />
                    </div>
                </div>

                <div className="preloader-footer">
                    <div className="preloader-meta">
                        <span>INDEX.VOL_3</span>
                        <span>LOADING_ASSETS</span>
                    </div>

                    <div className="preloader-counter" ref={counterRef}>
                        000
                    </div>

                    <div className="preloader-scroll-container">
                        <img
                            src="/scroll.svg"
                            alt="Scroll"
                            className="preloader-scroll"
                            ref={scrollRef}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

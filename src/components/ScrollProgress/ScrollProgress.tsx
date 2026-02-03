import React, { useEffect, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import './ScrollProgress.css';

interface ScrollProgressProps {
  containerRef?: React.RefObject<HTMLElement>;
  mode?: 'snapping' | 'linear';
}

/**
 * Component to render the numeric value of the MotionValue
 */
const ProgressNumber = ({ value }: { value: any }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    return value.onChange((latest: number) => {
      setDisplayValue(Math.round(latest * 100));
    });
  }, [value]);

  return <>{displayValue.toString().padStart(2, '0')}</>;
};

export const ScrollProgress: React.FC<ScrollProgressProps> = ({
  containerRef,
  mode = 'snapping'
}) => {
  // If containerRef is provided, track scroll of that element. 
  // Otherwise fallback to window scroll (React default behavior for useScroll without args)
  // Note: for useScroll(ref) to work, the ref must be attached to the scrollable element.
  const { scrollYProgress } = useScroll({
    container: containerRef || undefined
  });

  // Softer spring inputs for smoother feel
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 60,
    damping: 20,
    restDelta: 0.001
  });

  // Define 3 stop points on the screen 
  // All units relative to container height (which is 100vh)
  const stop1 = '20%';
  const stop2 = '50%';
  const stop3 = '80%';

  // Linear transition for articles, Snapping for the 3-stage pages
  const topPosition = useTransform(
    smoothProgress,
    mode === 'snapping'
      ? [0, 0.25, 0.40, 0.60, 0.75, 1]
      : [0, 1],
    mode === 'snapping'
      ? [stop1, stop1, stop2, stop2, stop3, stop3]
      : [stop1, stop3]
  );

  // Horizontal movement in relative units (%) relative to the wrapper width
  const xPosition = useTransform(
    smoothProgress,
    mode === 'snapping'
      ? [0, 0.25, 0.40, 0.60, 0.75, 1]
      : [0, 0.5, 1],
    mode === 'snapping'
      ? ['0%', '0%', '25%', '25%', '-10%', '-10%']
      : ['0%', '15%', '-5%']
  );

  // Subtle scale animation during movement
  const scale = useTransform(
    smoothProgress,
    [0.25, 0.32, 0.40, 0.60, 0.67, 0.75],
    [1, 1.1, 1, 1, 1.1, 1]
  );

  return (
    <div className="custom-scroll-wrapper">
      <div className="custom-scroll-track">
        {/* Visual Background from SVG */}
        <img src="/scroll.svg" alt="" className="custom-scroll-svg" />

        {/* Moving Indicator */}
        <motion.div
          className="custom-scroll-indicator"
          style={{
            top: topPosition,
            left: "50%",
            x: xPosition,
            scale: scale
          }}
        >
          <div className="indicator-circle">
            {/* SVG Ring with viewBox 0 0 100 100 for easy relative math */}
            <svg className="progress-ring" viewBox="0 0 100 100">
              {/* Background track */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="rgba(0,0,0,0.1)"
                strokeWidth="6"
                fill="none"
              />
              {/* Progress value */}
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                stroke="#333"
                strokeWidth="6"
                fill="none"
                pathLength={smoothProgress}
                style={{
                  rotate: -90,
                  transformOrigin: "center",
                  strokeLinecap: "round"
                }}
              />
            </svg>

            <span className="indicator-text">
              <ProgressNumber value={smoothProgress} />
            </span>
          </div>
        </motion.div>

        {/* Telegram Link at the bottom */}
        <a
          href="https://t.me/web_almanac"
          target="_blank"
          rel="noopener noreferrer"
          className="telegram-scroll-link"
          title="Telegram"
        >
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M28 4L4 14L12 18L28 4Z" fill="currentColor" opacity="0.2" />
            <path d="M28 4L12 18V28L16 22L28 4Z" fill="currentColor" opacity="0.1" />
            <path d="M28 4L4 14L12 18L16 22L28 4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M12 18V24L15 21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </div>
  );
};

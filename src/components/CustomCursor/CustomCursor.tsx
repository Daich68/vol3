import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import './CustomCursor.css';

export const CustomCursor: React.FC = () => {
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  
  const springConfig = { damping: 25, stiffness: 300 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.closest('a') ||
        target.closest('button') ||
        target.style.cursor === 'pointer'
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [cursorX, cursorY]);

  return (
    <>
      {/* Основной курсор - спиральная точка */}
      <motion.div
        className="custom-cursor"
        style={{
          left: cursorXSpring,
          top: cursorYSpring,
        }}
      >
        <motion.svg
          className="cursor-spiral"
          viewBox="0 0 40 40"
          animate={{
            scale: isClicking ? 0.8 : isHovering ? 1.5 : 1,
            rotate: isHovering ? 360 : 0,
          }}
          transition={{
            scale: { duration: 0.2 },
            rotate: { duration: 0.6, ease: "easeOut" }
          }}
        >
          {/* Центральная точка */}
          <circle
            cx="20"
            cy="20"
            r="2"
            fill="rgba(0, 0, 0, 0.6)"
          />
          
          {/* Спиральные линии */}
          <motion.path
            d="M 20,20 Q 25,18 28,20 Q 30,25 28,28 Q 23,30 20,28 Q 17,23 20,20"
            fill="none"
            stroke="rgba(0, 0, 0, 0.3)"
            strokeWidth="0.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: isHovering ? 1 : 0.5 }}
            transition={{ duration: 0.4 }}
          />
          
          <motion.path
            d="M 20,20 Q 15,18 12,20 Q 10,25 12,28 Q 17,30 20,28"
            fill="none"
            stroke="rgba(0, 0, 0, 0.3)"
            strokeWidth="0.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: isHovering ? 1 : 0.5 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          />

          {/* Внешний круг при наведении */}
          {isHovering && (
            <motion.circle
              cx="20"
              cy="20"
              r="15"
              fill="none"
              stroke="rgba(0, 0, 0, 0.15)"
              strokeWidth="0.5"
              strokeDasharray="2 2"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            />
          )}
        </motion.svg>
      </motion.div>

      {/* Следящий круг */}
      <motion.div
        className="cursor-follower"
        style={{
          left: cursorXSpring,
          top: cursorYSpring,
        }}
        animate={{
          scale: isClicking ? 0.5 : isHovering ? 1.2 : 1,
        }}
        transition={{
          scale: { duration: 0.3 }
        }}
      >
        <svg viewBox="0 0 60 60">
          <motion.circle
            cx="30"
            cy="30"
            r="28"
            fill="none"
            stroke="rgba(0, 0, 0, 0.08)"
            strokeWidth="0.5"
            strokeDasharray="3 3"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
        </svg>
      </motion.div>
    </>
  );
};

import React, { useEffect, useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import './ScrollProgress.css';

export const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return scrollYProgress.onChange((latest) => {
      setProgress(latest);
    });
  }, [scrollYProgress]);

  // Генерация спиральных веток
  const generateSpiralBranches = () => {
    const branches: Array<{
      position: number;
      side: 'left' | 'right';
      angle: number;
      length: number;
      thickness: number;
      curve: string;
      spiralOffset: number;
    }> = [];
    
    const positions = [0.1, 0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9];
    const spiralTurns = 3;
    
    positions.forEach((pos, index) => {
      const heightFactor = 1 - pos;
      const baseLength = 40;
      const baseThickness = 2.5;
      
      // Вычисляем положение на спирали
      const angle = (pos) * spiralTurns * Math.PI * 2;
      const radius = 3 * (1 - pos * 0.7);
      const spiralX = Math.cos(angle) * radius;
      
      // Определяем сторону по положению на спирали
      const side = Math.cos(angle) > 0 ? 'right' : 'left';
      
      // Угол ветки зависит от положения на спирали
      const branchAngle = (angle * 180 / Math.PI) + (side === 'left' ? 180 : 0);
      
      // Кривизна для создания спирали
      const curvature = index * 12;
      const length = baseLength * (0.5 + heightFactor * 0.5);
      
      branches.push({
        position: pos,
        side: side,
        angle: branchAngle,
        length: length,
        thickness: baseThickness * (0.4 + heightFactor * 0.6),
        curve: `M 0,0 Q ${curvature},${-curvature * 0.4} ${length},${-curvature * 0.2}`,
        spiralOffset: spiralX
      });
    });
    
    return branches;
  };

  const branches = generateSpiralBranches();

  // Ствол тоже закручивается
  const getTrunkPath = () => {
    const height = 100;
    const spiralTurns = 3; // Количество оборотов спирали
    const radius = 3; // Радиус спирали
    
    let path = `M 0,0`;
    
    for (let i = 0; i <= height; i += 0.5) {
      // Спираль: x и y меняются по синусоиде и косинусоиде
      const angle = (i / height) * spiralTurns * Math.PI * 2;
      const currentRadius = radius * (1 - i / height * 0.7); // Радиус уменьшается к верху
      
      const x = Math.cos(angle) * currentRadius;
      const y = i;
      
      path += ` L ${x},${y}`;
    }
    
    return path;
  };

  return (
    <div className="scroll-progress-container">
      {/* SVG для спирального ствола */}
      <svg className="scroll-trunk-svg" viewBox="-5 0 10 100" preserveAspectRatio="none">
        <motion.path
          d={getTrunkPath()}
          stroke="rgba(0, 0, 0, 0.1)"
          strokeWidth="0.3"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          style={{ 
            pathLength: scaleY,
          }}
        />
      </svg>

      {/* Спиральные ветки */}
      {branches.map((branch, index) => (
        <motion.div
          key={index}
          className={`scroll-branch-container scroll-branch-${branch.side}`}
          style={{
            top: `${branch.position * 100}%`,
            left: `calc(50% + ${branch.spiralOffset}px)`,
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: progress >= branch.position ? 1 : 0,
          }}
          transition={{
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1],
            delay: index * 0.04
          }}
        >
          <svg 
            className="branch-svg"
            viewBox={`0 -${branch.thickness * 2} ${branch.length} ${branch.thickness * 4}`}
            style={{
              width: `${branch.length}px`,
              height: `${branch.thickness * 3}px`,
              transform: branch.side === 'left' 
                ? `scaleX(-1) rotate(${-branch.angle}deg)`
                : `rotate(${branch.angle}deg)`,
            }}
          >
            <motion.path
              d={branch.curve}
              stroke="rgba(0, 0, 0, 0.1)"
              strokeWidth={branch.thickness}
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{
                pathLength: progress >= branch.position ? 1 : 0,
              }}
              transition={{
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1]
              }}
            />
          </svg>
        </motion.div>
      ))}

      {/* Процент в спиральном кружке */}
      <motion.div
        className="scroll-percentage-container"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ 
          opacity: progress > 0.05 && progress < 0.98 ? 1 : 0,
          scale: progress > 0.05 && progress < 0.98 ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
      >
        {/* SVG спиральный круг */}
        <svg className="percentage-spiral" viewBox="0 0 60 60">
          <motion.circle
            cx="30"
            cy="30"
            r="26"
            fill="none"
            stroke="rgba(0, 0, 0, 0.08)"
            strokeWidth="1"
            strokeDasharray="4 4"
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ 
              duration: 20, 
              repeat: Infinity, 
              ease: "linear" 
            }}
          />
          <motion.path
            d="M 30,4 Q 50,10 54,30 Q 50,50 30,56 Q 10,50 6,30 Q 10,10 30,4"
            fill="none"
            stroke="rgba(0, 0, 0, 0.1)"
            strokeWidth="0.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
        </svg>
        
        <div className="scroll-percentage">
          {Math.round(progress * 100)}
        </div>
      </motion.div>
    </div>
  );
};

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMusic } from '../../contexts/MusicContext';
import './TreeNavigation.css';

interface Branch {
  id: string;
  label: string;
  description: string;
  path: string;
  level: number;
  pattern: string;
  videoSrc?: string;
}

export const TreeNavigation: React.FC = () => {
  const navigate = useNavigate();
  const [hoveredBranch, setHoveredBranch] = useState<string | null>(null);
  const { playButtonSound } = useMusic();

  const branches: Branch[] = [
    {
      id: 'notes',
      label: 'записи',
      description: 'ваши мысли и наблюдения',
      path: '/notes',
      level: 1,
      pattern: 'M20,10 Q30,5 40,10 T60,10 Q70,15 80,10',
      videoSrc: '/grok-video-7223f3a3-740c-4475-94e7-61fb94c7e026.mp4'
    },
    {
      id: 'search',
      label: 'поиск',
      description: 'найти других авторов',
      path: '/search',
      level: 1,
      pattern: 'M10,20 C15,10 25,30 30,20 S45,10 50,20 S65,30 70,20',
      videoSrc: '/grok-video-7223f3a3-740c-4475-94e7-61fb94c7e026 (1).mp4'
    },
    {
      id: 'philosophy',
      label: 'философия',
      description: 'размышления о бытии',
      path: '/philosophy',
      level: 2,
      pattern: 'M15,15 Q25,5 35,15 Q45,25 55,15 Q65,5 75,15'
    },
    {
      id: 'person',
      label: 'профиль',
      description: 'ваша страница и словарик',
      path: '/person',
      level: 2,
      pattern: 'M10,25 C20,15 30,35 40,25 C50,15 60,35 70,25'
    },
    {
      id: 'login',
      label: 'вход',
      description: 'присоединиться к дереву',
      path: '/login',
      level: 2,
      pattern: 'M20,15 Q30,25 40,15 T60,15 T80,15'
    },


  ];

  const handleBranchClick = (path: string) => {
    playButtonSound();
    navigate(path);
  };

  return (
    <div className="tree-navigation">
      <motion.div
        className="tree-trunk"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="trunk-line" />
      </motion.div>

      <div className="branches-container">
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            {branches.map((branch) => (
              <pattern
                key={`pattern-${branch.id}`}
                id={`organic-pattern-${branch.id}`}
                x="0"
                y="0"
                width="100"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={branch.pattern}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  fill="none"
                  opacity="0.15"
                />
                <path
                  d={branch.pattern}
                  stroke="currentColor"
                  strokeWidth="0.3"
                  fill="none"
                  opacity="0.1"
                  transform="translate(10, 5)"
                />
              </pattern>
            ))}
          </defs>
        </svg>

        {branches.map((branch, index) => (
          <motion.div
            key={branch.id}
            className={`branch branch-level-${branch.level} ${hoveredBranch === branch.id ? 'hovered' : ''}`}
            data-branch-id={branch.id}
            initial={{ opacity: 0, x: branch.level === 1 ? -50 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.6,
              delay: 0.3 + index * 0.15,
              ease: "easeOut"
            }}
            onMouseEnter={() => setHoveredBranch(branch.id)}
            onMouseLeave={() => setHoveredBranch(null)}
            onClick={() => handleBranchClick(branch.path)}
          >
            <div className="branch-connector" />
            <div className="branch-content">
              {branch.videoSrc && (
                <>
                  <video
                    className="branch-video"
                    src={branch.videoSrc}
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                  <div className="branch-video-frame" />
                </>
              )}
              <div className="branch-label">{branch.label}</div>
              <motion.div
                className="branch-description"
                initial={{ opacity: 0, height: 0 }}
                animate={{
                  opacity: hoveredBranch === branch.id ? 1 : 0,
                  height: hoveredBranch === branch.id ? 'auto' : 0
                }}
                transition={{ duration: 0.3 }}
              >
                {branch.description}
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

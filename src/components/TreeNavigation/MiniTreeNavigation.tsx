import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMusic } from '../../contexts/MusicContext';
import './MiniTreeNavigation.css';

interface Branch {
  id: string;
  label: string;
  path: string;
  pattern: string;
}

export const MiniTreeNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const { playButtonSound } = useMusic();

  const branches: Branch[] = [
    { id: 'about', label: 'о проекте', path: '/', pattern: 'M10,15 Q20,10 30,15 T50,15' },
    { id: 'notes', label: 'записи', path: '/notes', pattern: 'M20,10 Q30,5 40,10 T60,10' },
    { id: 'search', label: 'поиск', path: '/search', pattern: 'M10,20 C15,10 25,30 30,20' },
    { id: 'philosophy', label: 'философия', path: '/philosophy', pattern: 'M15,15 Q25,5 35,15 Q45,25 55,15' },
    { id: 'person', label: 'профиль', path: '/person', pattern: 'M10,25 C20,15 30,35 40,25' },
    { id: 'login', label: 'вход', path: '/login', pattern: 'M20,15 Q30,25 40,15 T60,15' },
  ];

  const handleBranchClick = (path: string) => {
    playButtonSound();
    navigate(path);
    setIsExpanded(false);
  };

  const toggleExpanded = () => {
    playButtonSound();
    setIsExpanded(!isExpanded);
  };


  const isCurrentPage = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/about';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <div className="mini-tree-nav">
        <button
          className="mini-tree-toggle"
          onClick={toggleExpanded}
          aria-label={isExpanded ? "Свернуть навигацию" : "Развернуть навигацию"}
          aria-expanded={isExpanded}
        >
          <motion.svg width="40" height="40" viewBox="0 0 40 40" whileHover={{ scale: 1.05 }}>
            <motion.line
              x1="20" y1="10" x2="20" y2="30"
              stroke="currentColor"
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5 }}
            />
            <motion.circle
              cx="20" cy="10" r="3"
              fill="currentColor"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 }}
            />
            <motion.line
              x1="20" y1="20" x2="12" y2="15"
              stroke="currentColor"
              strokeWidth="1.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: isExpanded ? 1 : 0.5 }}
              transition={{ duration: 0.3 }}
            />
            <motion.line
              x1="20" y1="20" x2="28" y2="15"
              stroke="currentColor"
              strokeWidth="1.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: isExpanded ? 1 : 0.5 }}
              transition={{ duration: 0.3 }}
            />
          </motion.svg>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="mini-tree-menu"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mini-tree-trunk" />
              <div className="mini-tree-branches">
                {branches.map((branch, index) => (
                  <motion.button
                    key={branch.id}
                    className={`mini-tree-branch ${isCurrentPage(branch.path) ? 'active' : ''}`}
                    data-branch-id={branch.id}
                    onClick={() => handleBranchClick(branch.path)}
                    initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    aria-current={isCurrentPage(branch.path) ? 'page' : undefined}
                  >
                    <span className="branch-dot" />
                    <span className="branch-label">{branch.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isExpanded && (
          <div
            className="mini-tree-overlay"
            onClick={() => setIsExpanded(false)}
            aria-hidden="true"
          />
        )}
      </div>
    </>
  );
};

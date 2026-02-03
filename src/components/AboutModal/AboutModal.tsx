import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import './AboutModal.css';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="modal-container">
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              <button
                className="modal-close"
                onClick={onClose}
                aria-label="Закрыть"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <div className="modal-body">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h2 id="modal-title" className="modal-section-title">что такое вольтри?</h2>
                  <div className="modal-text">
                    <p>вольтри — это спокойная социальная сеть, которая имеет свой язык</p>
                    <p>каждый пользователь — это автор языка, на страничке пользователя можно найти личный словарик</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h3 className="modal-section-title">принципы</h3>
                  <div className="modal-principles">
                    <div className="modal-principle">
                      <span className="modal-principle-icon">◉</span>
                      <div>
                        <div className="modal-principle-title">осознанность</div>
                        <div className="modal-principle-text">каждое слово имеет значение</div>
                      </div>
                    </div>
                    
                    <div className="modal-principle">
                      <span className="modal-principle-icon">◎</span>
                      <div>
                        <div className="modal-principle-title">размеренность</div>
                        <div className="modal-principle-text">одно сообщение в день</div>
                      </div>
                    </div>
                    
                    <div className="modal-principle">
                      <span className="modal-principle-icon">◈</span>
                      <div>
                        <div className="modal-principle-title">всматривание</div>
                        <div className="modal-principle-text">погружение в себя</div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h3 className="modal-section-title">ограничения</h3>
                  <div className="modal-text">
                    <p>поэтому «электрическое дерево» (как иногда называют эту площадку) ограничивает нас</p>
                    <ul className="modal-list">
                      <li>лимит в размере сообщения</li>
                      <li>можно писать только раз в день</li>
                      <li>пост нельзя удалить или отредактировать</li>
                    </ul>
                  </div>
                </motion.div>

                <motion.div
                  className="modal-footer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <p>используйте вольтри-язык, и просто оставайтесь здесь столько, сколько пожелаете</p>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

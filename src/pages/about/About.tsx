import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { TreeNavigation } from "../../components/TreeNavigation/TreeNavigation";
import { ScrollProgress } from "../../components/ScrollProgress/ScrollProgress";
import "./About.css"


export const About: React.FC = () => {
    const navigate = useNavigate();
    const treeRef = useRef<HTMLDivElement>(null);
    
    const isTreeInView = useInView(treeRef, { once: false, amount: 0.3 });

    return (
      <div className={"about"}>
        <ScrollProgress />
        
        <motion.div
          ref={treeRef}
          className="tree-section"
          initial={{ opacity: 0 }}
          animate={{ opacity: isTreeInView ? 1 : 0.3 }}
          transition={{ duration: 0.6 }}
        >
          {/* Статистика/Особенности */}
          <motion.div 
            className="features-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: isTreeInView ? 1 : 0,
              y: isTreeInView ? 0 : 20
            }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="features-grid">
              <motion.div 
                className="feature-item"
                whileHover={{ 
                  y: -5,
                  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.08)"
                }}
                transition={{ duration: 0.3 }}
              >
                <motion.div 
                  className="feature-number"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2 }}
                >
                  1
                </motion.div>
                <div className="feature-label">пост в день</div>
              </motion.div>
              
              <motion.div 
                className="feature-item"
                whileHover={{ 
                  y: -5,
                  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.08)"
                }}
                transition={{ duration: 0.3 }}
              >
                <motion.div 
                  className="feature-number"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2 }}
                >
                  ∞
                </motion.div>
                <div className="feature-label">слов в словаре</div>
              </motion.div>
              
              <motion.div 
                className="feature-item"
                whileHover={{ 
                  y: -5,
                  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.08)"
                }}
                transition={{ duration: 0.3 }}
              >
                <motion.div 
                  className="feature-number"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2 }}
                >
                  0
                </motion.div>
                <div className="feature-label">редактирований</div>
              </motion.div>
            </div>
          </motion.div>

          <motion.div 
            className="tree-divider"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ 
              opacity: isTreeInView ? 1 : 0,
              scale: isTreeInView ? 1 : 0.9
            }}
            transition={{ duration: 0.5 }}
          >
            <motion.div 
              className="divider-line"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: isTreeInView ? 1 : 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            />
            <motion.div 
              className="divider-text"
              initial={{ opacity: 0, y: 10 }}
              animate={{ 
                opacity: isTreeInView ? 1 : 0,
                y: isTreeInView ? 0 : 10
              }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              навигация
            </motion.div>
            <motion.div 
              className="divider-line"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: isTreeInView ? 1 : 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            />
          </motion.div>
          <TreeNavigation />
        </motion.div>


      </div>
    );
};

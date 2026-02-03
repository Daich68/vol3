import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { TreeNavigation } from "../../components/TreeNavigation/TreeNavigation";
import { PageFrame } from "../../components/PageFrame/PageFrame";
import "./About.css"


export const About: React.FC = () => {
  const navigate = useNavigate();
  const treeRef = useRef<HTMLDivElement>(null);

  // We keep useInView for triggering animations of children, but main container stays visible
  const isTreeInView = useInView(treeRef, { once: false, amount: 0.3 });

  return (
    <PageFrame>
      <div className={"about"}>
        <motion.div
          ref={treeRef}
          className="tree-section"
          // Remove the dimming effect. Initial 0 for fade-in on load, then always 1.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="features-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: 1, // Always visible once loaded
              y: 0
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
              opacity: 1,
              scale: 1
            }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div
              className="divider-line"
              style={{ transform: "scaleX(1)" }} // Static for now to ensure visibility
            />
            <div className="divider-text">
              навигация
            </div>
            <div
              className="divider-line"
              style={{ transform: "scaleX(1)" }}
            />
          </motion.div>

          <TreeNavigation />
        </motion.div>
      </div>
    </PageFrame>
  );
};

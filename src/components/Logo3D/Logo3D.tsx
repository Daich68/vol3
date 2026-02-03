import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, PerspectiveCamera } from '@react-three/drei';
import { motion } from 'framer-motion';
import './Logo3D.css';

function Model() {
  const modelRef = useRef<any>();
  const { scene } = useGLTF('/43eea0ecea4e2db403172ebe4e086e79.glb');

  // Медленное автоматическое вращение
  useFrame((state, delta) => {
    if (modelRef.current) {
      modelRef.current.rotation.y += delta * 0.15;
      // Легкое покачивание вверх-вниз
      modelRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <primitive 
      ref={modelRef}
      object={scene} 
      scale={2.5}
      position={[0, 0, 0]}
    />
  );
}

export const Logo3D: React.FC = () => {
  return (
    <motion.div 
      className="logo-3d-container"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance"
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45} />
        
        <Suspense fallback={null}>
          {/* Основное освещение */}
          <ambientLight intensity={0.6} />
          
          {/* Ключевой свет сверху */}
          <directionalLight 
            position={[5, 8, 5]} 
            intensity={1.2}
            castShadow
          />
          
          {/* Заполняющий свет */}
          <pointLight position={[-5, 3, -5]} intensity={0.8} color="#ffffff" />
          
          {/* Контровой свет */}
          <spotLight 
            position={[0, -5, 5]} 
            angle={0.3} 
            penumbra={1} 
            intensity={0.5}
            color="#a0c4ff"
          />
          
          {/* Акцентный свет */}
          <pointLight position={[3, 0, -3]} intensity={0.6} color="#ffd700" />
          
          <Model />
          
          {/* Окружение для реалистичных отражений */}
          <Environment preset="sunset" />
        </Suspense>
      </Canvas>
    </motion.div>
  );
};

// Preload the model
useGLTF.preload('/43eea0ecea4e2db403172ebe4e086e79.glb');

import React, { createContext, useContext, useState, ReactNode } from 'react';
import useSound from 'use-sound';
// @ts-ignore
import vol3wav from '../static/sound/vol3.wav';
// @ts-ignore
import button from '../static/sound/button.wav';

interface MusicContextType {
  isPlaying: boolean;
  toggleMusic: () => void;
  playButtonSound: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [play, { stop }] = useSound(vol3wav, { volume: 0.5, loop: true });
  const [playB] = useSound(button, { volume: 2, loop: false });
  const [isPlaying, setIsPlaying] = useState(false);

  const toggleMusic = () => {
    if (isPlaying) {
      stop();
      setIsPlaying(false);
    } else {
      playB();
      play();
      setIsPlaying(true);
    }
  };

  const playButtonSound = () => {
    playB();
  };

  return (
    <MusicContext.Provider value={{ isPlaying, toggleMusic, playButtonSound }}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};

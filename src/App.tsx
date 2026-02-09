import React, { createContext, useContext, useState } from "react";
import "./App.css";
import { Login } from "./pages/login/Login";
import { Routes, Route, BrowserRouter, useLocation } from "react-router-dom";
import { MiniTreeNavigation } from "./components/TreeNavigation/MiniTreeNavigation";
import { NoticePage } from "./pages/notice/Notice";
import { Search } from "./pages/search/Search";
import { AuthRedirect } from "./pages/person/AuthRedirect";
import { About } from "./pages/about/About";
import { Philosophy } from "./pages/philosophy/Philosophy";
import { AuthorPage } from "./pages/author/AuthorPage";
import { NotFound } from "./pages/notfound/NotFound";
import { safeLocalStorage } from "./utils/localStorage";
import { MusicProvider } from "./contexts/MusicContext";
import { Preloader } from "./components/Preloader/Preloader";
import { LoaderContext } from "./contexts/LoaderContext";

function AppContent() {
    const location = useLocation();
    const isHomePage = location.pathname === "/" || location.pathname === "/about";

    return (
        <>
            {!isHomePage && <MiniTreeNavigation />}
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/notes" element={<NoticePage />} />
                <Route path="/search" element={<Search />} />
                <Route
                    path="/person"
                    element={<AuthRedirect id={safeLocalStorage.getItem("ID")} />}
                />
                <Route path="/about" element={<About />} />
                <Route path="/philosophy" element={<Philosophy />} />
                <Route path="/" element={<About />} />
                <Route path="/author/:id" element={<AuthorPage />} />
                <Route path="/not-found" element={<NotFound />} />
                <Route path="/*" element={<NotFound />} />
            </Routes>
        </>
    );
}

function App() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [showPreloader, setShowPreloader] = useState(true);

    const handlePreloaderComplete = () => {
        setShowPreloader(false);
    };

    const handlePreloaderStartExit = () => {
        setIsLoaded(true);
    };

    return (
        <LoaderContext.Provider value={{ isLoaded }}>
            {showPreloader && (
                <Preloader
                    onComplete={handlePreloaderComplete}
                    onStartExit={handlePreloaderStartExit}
                />
            )}
            <BrowserRouter>
                <MusicProvider>
                    <AppContent />
                </MusicProvider>
            </BrowserRouter>
        </LoaderContext.Provider>
    );
}

export default App;

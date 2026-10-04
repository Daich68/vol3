import React, { useState } from "react";
import "./App.css";
import { Login } from "./pages/login/Login";
import { Routes, Route, BrowserRouter, Navigate, useLocation } from "react-router-dom";
import { MiniTreeNavigation } from "./components/TreeNavigation/MiniTreeNavigation";
import { NoticePage } from "./pages/notice/Notice";
import { Search } from "./pages/search/Search";
import { AuthRedirect } from "./pages/person/AuthRedirect";
import { About } from "./pages/about/About";
import { AuthorPage } from "./pages/author/AuthorPage";
import { NotFound } from "./pages/notfound/NotFound";
import { safeLocalStorage } from "./utils/localStorage";
import { MusicProvider } from "./contexts/MusicContext";
import { Preloader } from "./components/Preloader/Preloader";
import { LoaderContext } from "./contexts/LoaderContext";
import { OnboardingProvider } from "./components/Onboarding/Onboarding";
import { CatDestination, catDestinationOnArrival } from "./components/Onboarding/onboardingState";

interface AppContentProps {
    catArrival: CatDestination;
    catHandoff: DOMRect | null;
    isLoaded: boolean;
}

function AppContent({ catArrival, catHandoff, isLoaded }: AppContentProps) {
    const location = useLocation();
    const isHomePage = location.pathname === "/" || location.pathname === "/about";

    return (
        <OnboardingProvider arrival={catArrival} handoff={catHandoff} loaded={isLoaded}>
            {!isHomePage && <MiniTreeNavigation />}
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/notes" element={<NoticePage />} />
                <Route path="/notes/:id" element={<NoticePage />} />
                <Route path="/search" element={<Search />} />
                <Route
                    path="/person"
                    element={<AuthRedirect id={safeLocalStorage.getItem("ID")} />}
                />
                <Route path="/about" element={<About />} />
                {/* philosophy now lives on the home page */}
                <Route path="/philosophy" element={<Navigate to="/" replace state={{ section: "philosophy" }} />} />
                <Route path="/" element={<About />} />
                <Route path="/author/:id" element={<AuthorPage />} />
                <Route path="/not-found" element={<NotFound />} />
                <Route path="/*" element={<NotFound />} />
            </Routes>
        </OnboardingProvider>
    );
}

function App() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [showPreloader, setShowPreloader] = useState(true);
    // decided once, before the curtain lifts: does the cat stay on screen, and where does she go
    const [catArrival] = useState<CatDestination>(() => catDestinationOnArrival(window.location.pathname));
    const [catHandoff, setCatHandoff] = useState<DOMRect | null>(null);

    const handlePreloaderComplete = () => {
        setShowPreloader(false);
    };

    const handlePreloaderStartExit = (catRect: DOMRect | null) => {
        setCatHandoff(catRect);
        setIsLoaded(true);
    };

    return (
        <LoaderContext.Provider value={{ isLoaded }}>
            {showPreloader && (
                <Preloader
                    onComplete={handlePreloaderComplete}
                    onStartExit={handlePreloaderStartExit}
                    keepCat={catArrival !== null}
                    catHandedOff={catHandoff !== null}
                />
            )}
            <BrowserRouter>
                <MusicProvider>
                    <AppContent catArrival={catArrival} catHandoff={catHandoff} isLoaded={isLoaded} />
                </MusicProvider>
            </BrowserRouter>
        </LoaderContext.Provider>
    );
}

export default App;

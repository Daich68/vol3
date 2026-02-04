import React from "react";
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

function AppContent() {
    const location = useLocation();
    const isHomePage = location.pathname === "/" || location.pathname === "/about";
    const isPhilosophyPage = location.pathname === "/philosophy";

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
    return (
        <BrowserRouter>
            <MusicProvider>
                <AppContent />
            </MusicProvider>
        </BrowserRouter>
    );
}

export default App;

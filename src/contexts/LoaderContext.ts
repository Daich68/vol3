import { createContext, useContext } from "react";

export const LoaderContext = createContext({ isLoaded: false });
export const useLoader = () => useContext(LoaderContext);

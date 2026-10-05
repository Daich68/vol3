import { createContext, useContext } from "react";

export type GuideEntry = "intro" | "write";

interface OnboardingContextType {
    /** true while nobody is signed in — the guide makes sense only for guests */
    guest: boolean;
    openGuide: (entry?: GuideEntry) => void;
    /** the daily wheel of companions, for a signed-in author */
    openWheel: () => void;
    /** the walk around the site, again — for an author who wants to see it once more */
    openTour: () => void;
}

export const OnboardingContext = createContext<OnboardingContextType>({
    guest: false,
    openGuide: () => undefined,
    openWheel: () => undefined,
    openTour: () => undefined,
});

export const useOnboarding = () => useContext(OnboardingContext);

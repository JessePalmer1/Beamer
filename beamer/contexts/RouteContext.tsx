import React, { createContext, useContext, useState, ReactNode } from 'react';

interface RouteLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

interface RouteSegment {
  points: Array<{ lat: number; lng: number }>;
  distance: number;
  duration: number;
  instruction: string;
  avgGlareScore?: number; // Average sun glare score for this segment
  glareRiskLevel?: 'low' | 'medium' | 'high'; // Risk level based on glare score
}

interface RouteProfile {
  segments: RouteSegment[];
  totalDistance: number;
  totalDuration: number;
  polylinePoints: Array<{ lat: number; lng: number }>;
  rawDirectionsData?: any; // Full Google Maps response for debugging
  error?: string; // Error message if profile processing failed
  glareAnalysis?: {
    totalPoints: number;
    maxGlare: number;
    minGlare: number;
    avgGlare: number;
    highGlarePoints: number;
    departureTime: string;
    arrivalTime: string;
  }; // Overall glare statistics for the route
}

interface AnalyzeRoute {
  start: RouteLocation;
  end: RouteLocation;
  name?: string;
  departureTime: string;
  profile?: RouteProfile;
}

interface RouteContextType {
  currentRoute: AnalyzeRoute | null;
  setCurrentRoute: (route: AnalyzeRoute | null) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  departureTime: Date;
  setDepartureTime: (time: Date) => void;
}

const RouteContext = createContext<RouteContextType | undefined>(undefined);

export const useRoute = () => {
  const context = useContext(RouteContext);
  if (context === undefined) {
    throw new Error('useRoute must be used within a RouteProvider');
  }
  return context;
};

interface RouteProviderProps {
  children: ReactNode;
}

export const RouteProvider: React.FC<RouteProviderProps> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<AnalyzeRoute | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [departureTime, setDepartureTime] = useState<Date>(new Date());

  const value: RouteContextType = {
    currentRoute,
    setCurrentRoute,
    isAnalyzing,
    setIsAnalyzing,
    departureTime,
    setDepartureTime,
  };

  return (
    <RouteContext.Provider value={value}>
      {children}
    </RouteContext.Provider>
  );
};

export type { AnalyzeRoute, RouteLocation, RouteProfile, RouteSegment };

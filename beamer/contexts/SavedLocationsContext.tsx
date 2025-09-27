import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SavedLocation {
  id: string;
  name: string;
  startAddress?: string;
  endAddress?: string;
  startCoordinates: {latitude: number; longitude: number};
  endCoordinates: {latitude: number; longitude: number};
  savedAt: string;
}

interface SavedLocationsContextType {
  savedLocations: SavedLocation[];
  addSavedLocation: (location: SavedLocation) => Promise<void>;
  updateSavedLocation: (id: string, updates: Partial<SavedLocation>) => Promise<void>;
  deleteSavedLocation: (id: string) => Promise<void>;
  refreshSavedLocations: () => Promise<void>;
}

const SavedLocationsContext = createContext<SavedLocationsContextType | undefined>(undefined);

export const useSavedLocations = () => {
  const context = useContext(SavedLocationsContext);
  if (context === undefined) {
    throw new Error('useSavedLocations must be used within a SavedLocationsProvider');
  }
  return context;
};

interface SavedLocationsProviderProps {
  children: ReactNode;
}

export const SavedLocationsProvider: React.FC<SavedLocationsProviderProps> = ({ children }) => {
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

  const loadSavedLocations = async () => {
    try {
      const saved = await AsyncStorage.getItem('savedLocations');
      if (saved) {
        setSavedLocations(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading saved locations:', error);
    }
  };

  const saveSavedLocations = async (locations: SavedLocation[]) => {
    try {
      await AsyncStorage.setItem('savedLocations', JSON.stringify(locations));
      setSavedLocations(locations);
    } catch (error) {
      console.error('Error saving locations:', error);
      throw error;
    }
  };

  const addSavedLocation = async (location: SavedLocation) => {
    const newLocations = [...savedLocations, location];
    await saveSavedLocations(newLocations);
  };

  const updateSavedLocation = async (id: string, updates: Partial<SavedLocation>) => {
    const newLocations = savedLocations.map(loc =>
      loc.id === id ? { ...loc, ...updates } : loc
    );
    await saveSavedLocations(newLocations);
  };

  const deleteSavedLocation = async (id: string) => {
    const newLocations = savedLocations.filter(loc => loc.id !== id);
    await saveSavedLocations(newLocations);
  };

  const refreshSavedLocations = async () => {
    await loadSavedLocations();
  };

  useEffect(() => {
    loadSavedLocations();
  }, []);

  const value: SavedLocationsContextType = {
    savedLocations,
    addSavedLocation,
    updateSavedLocation,
    deleteSavedLocation,
    refreshSavedLocations,
  };

  return (
    <SavedLocationsContext.Provider value={value}>
      {children}
    </SavedLocationsContext.Provider>
  );
};

export type { SavedLocation };

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface OfficerField {
  badge: string;
  username: string;
  rank: string;
  userId: string;
  callsign: string;
}

export function useOfficerProfile() {
  const [primaryOfficerData, setPrimaryOfficerData] = useState<OfficerField>({
    badge: "",
    username: "",
    rank: "",
    userId: "",
    callsign: ""
  });

  const [savedOfficerList, setSavedOfficerList] = useState<OfficerField[]>([]);

  // Get current user data to sync rank changes
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/me");
      if (!response.ok) {
        throw new Error("Failed to fetch current user");
      }
      return response.json();
    },
    refetchInterval: 5000, // Refetch every 5 seconds to catch rank updates
  });

  // Load profile data from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('officerProfile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPrimaryOfficerData(parsed);
      } catch (error) {
        console.log('Failed to parse saved officer profile');
      }
    }

    const savedList = localStorage.getItem('savedOfficerList');
    if (savedList) {
      try {
        const parsed = JSON.parse(savedList);
        setSavedOfficerList(parsed);
      } catch (error) {
        console.log('Failed to parse saved officer list');
      }
    }
  }, []);

  // Update rank when current user data changes
  useEffect(() => {
    if (currentUser?.user && primaryOfficerData.userId === currentUser.user.discordId) {
      const updatedProfile = {
        ...primaryOfficerData,
        rank: currentUser.user.rank || "Officer",
        callsign: currentUser.user.callsign || "" //Added callsign to updatedProfile
      };
      setPrimaryOfficerData(updatedProfile);
      localStorage.setItem('officerProfile', JSON.stringify(updatedProfile));

      // Also update saved officer list if the first officer matches
      if (savedOfficerList.length > 0 && savedOfficerList[0].userId === currentUser.user.discordId) {
        const updatedList = [...savedOfficerList];
        updatedList[0] = {
          ...updatedList[0],
          rank: currentUser.user.rank || "Officer",
          callsign: currentUser.user.callsign || "" //Added callsign to updatedList[0]
        };
        setSavedOfficerList(updatedList);
        localStorage.setItem('savedOfficerList', JSON.stringify(updatedList));
      }
    }
  }, [currentUser, primaryOfficerData.userId]);

  const autoSaveProfile = (profileData: OfficerField) => {
    console.log('🔄 Auto-saving officer profile:', profileData);
    setPrimaryOfficerData(profileData);
    localStorage.setItem('officerProfile', JSON.stringify(profileData));
    console.log('✅ Officer profile saved to localStorage');
  };

  const saveOfficerList = (officerList: OfficerField[]) => {
    console.log('🔄 Saving officer list:', officerList);
    setSavedOfficerList(officerList);
    localStorage.setItem('savedOfficerList', JSON.stringify(officerList));
    console.log('✅ Officer list saved to localStorage');
  };

  return {
    primaryOfficerData,
    savedOfficerList,
    autoSaveProfile,
    saveOfficerList
  };
}
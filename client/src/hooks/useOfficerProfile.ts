import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { apiRequest } from '@/lib/queryClient';

export interface OfficerData {
  badge: string;
  username: string;
  rank: string;
  userId: string;
}

export interface OfficerProfile {
  rpName?: string;
  rank?: string;
  discordId?: string;
  badgeNumber?: string;
}

export function useOfficerProfile() {
  const { user } = useAuth();
  const [savedOfficerList, setSavedOfficerList] = useState<OfficerData[]>([]);

  // Auto-populate primary officer data from user profile
  const getPrimaryOfficerData = (): OfficerData => {
    if (!user) {
      return { badge: '', username: '', rank: '', userId: '' };
    }

    return {
      badge: user.badgeNumber || '',
      username: user.fullName || user.rpName || '',
      rank: user.rank || '',
      userId: user.discordId || ''
    };
  };

  // Load saved officer list from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('savedOfficerList');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setSavedOfficerList(parsed);
      } catch (error) {
        console.error('Failed to parse saved officer list:', error);
      }
    }
  }, []);

  // Save officer list to localStorage
  const saveOfficerList = (officers: OfficerData[]) => {
    setSavedOfficerList(officers);
    localStorage.setItem('savedOfficerList', JSON.stringify(officers));
  };

  // Clear officer list (on logout)
  const clearOfficerList = () => {
    setSavedOfficerList([]);
    localStorage.removeItem('savedOfficerList');
  };

  // Clear secondary officers but keep primary officer
  const clearSecondaryOfficers = () => {
    const primaryOfficer = getPrimaryOfficerData();
    if (primaryOfficer.badge || primaryOfficer.username || primaryOfficer.rank || primaryOfficer.userId) {
      const primaryOfficerOnly = [primaryOfficer];
      setSavedOfficerList(primaryOfficerOnly);
      localStorage.setItem('savedOfficerList', JSON.stringify(primaryOfficerOnly));
    } else {
      clearOfficerList();
    }
  };

  // Update user profile with officer information
  const updateProfile = async (profile: OfficerProfile) => {
    try {
      const response = await apiRequest('PUT', '/api/auth/profile', profile);
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      return await response.json();
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  };

  // Auto-save profile when officer data is entered for the first time
  const autoSaveProfile = async (officerData: OfficerData) => {
    if (!user) {
      console.log('❌ No user found, skipping profile auto-save');
      return;
    }

    console.log('🔄 Auto-save profile check:', {
      currentUser: { badgeNumber: user.badgeNumber, rpName: user.rpName, rank: user.rank, discordId: user.discordId },
      officerData: { badge: officerData.badge, username: officerData.username, rank: officerData.rank, userId: officerData.userId }
    });

    // Check if profile needs updating - update if any field is different or meaningful
    const needsUpdate = 
      (officerData.badge && officerData.badge !== user.badgeNumber) ||
      (officerData.username && officerData.username !== user.rpName && officerData.username.length > 1) ||
      (officerData.rank && officerData.rank !== user.rank) ||
      (officerData.userId && officerData.userId !== user.discordId);

    console.log('🔍 Profile update needed:', needsUpdate);

    if (needsUpdate) {
      const profileData = {
        badgeNumber: officerData.badge || user.badgeNumber,
        rpName: (officerData.username && officerData.username.length > 1) ? officerData.username : user.rpName,
        rank: officerData.rank || user.rank,
        discordId: officerData.userId || user.discordId
      };

      console.log('📡 Sending profile update:', profileData);

      try {
        const result = await updateProfile(profileData);
        console.log('✅ Profile update successful:', result);
      } catch (error) {
        console.error('❌ Auto-save profile failed:', error);
      }
    }
  };

  return {
    primaryOfficerData: getPrimaryOfficerData(),
    savedOfficerList,
    saveOfficerList,
    clearOfficerList,
    clearSecondaryOfficers,
    updateProfile,
    autoSaveProfile
  };
}
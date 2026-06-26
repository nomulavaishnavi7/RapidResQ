// ======================================================
// FILE: src/hooks/useEmergencyNotifications.ts
// ======================================================

import { useRef, useEffect, useCallback } from 'react';
import { Emergency } from '../types';

interface UseEmergencyNotificationsProps {
  onNewEmergency?: (emergency: Emergency) => void;
  playSound?: boolean;
  showBrowserNotification?: boolean;
}

export const useEmergencyNotifications = ({
  onNewEmergency,
  playSound = true,
  showBrowserNotification = true
}: UseEmergencyNotificationsProps = {}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousEmergenciesRef = useRef<Set<string>>(new Set());

  // Initialize audio
  useEffect(() => {
    if (playSound) {
      // Create audio element for notification sound
      audioRef.current = new Audio('/notification.mp3');
      // Fallback to browser beep if custom sound not available
      audioRef.current.onerror = () => {
        console.warn('Notification sound not found, using fallback');
      };
    }
    
    // Request notification permission
    if (showBrowserNotification && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [playSound, showBrowserNotification]);

  // Play notification sound
  const playNotificationSound = useCallback(async () => {
    if (!playSound) return;
    
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      } else {
        // Fallback: create a simple beep using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.5;
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        // Close context after sound
        setTimeout(() => audioContext.close(), 600);
      }
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, [playSound]);

  // Show browser notification
  const showBrowserNotificationAlert = useCallback((emergency: Emergency) => {
    if (!showBrowserNotification) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    
    const notification = new Notification('🚨 New Emergency Alert!', {
      body: `${emergency.patientName} - ${emergency.patientCondition}`,
      icon: '/hospital-icon.png',
      tag: `emergency-${emergency.id}`,
      requireInteraction: true
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
      onNewEmergency?.(emergency);
    };
    
    setTimeout(() => notification.close(), 10000);
  }, [showBrowserNotification, onNewEmergency]);

  // Track new emergencies
  const checkForNewEmergencies = useCallback((emergencies: Emergency[]) => {
    const currentIds = new Set(emergencies.map(e => e.id));
    const previousIds = previousEmergenciesRef.current;
    
    // Find new emergencies
    const newEmergencies = emergencies.filter(e => !previousIds.has(e.id) && e.status === 'pending');
    
    if (newEmergencies.length > 0) {
      // Play sound for new emergencies
      playNotificationSound();
      
      // Show browser notifications
      newEmergencies.forEach(emergency => {
        showBrowserNotificationAlert(emergency);
        onNewEmergency?.(emergency);
      });
    }
    
    previousEmergenciesRef.current = currentIds;
  }, [playNotificationSound, showBrowserNotificationAlert, onNewEmergency]);

  return { checkForNewEmergencies };
};
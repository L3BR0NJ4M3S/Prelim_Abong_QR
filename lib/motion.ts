import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export const MOTION = {
  press: 130,
  interface: 220,
  screen: 320,
  confirmation: 460,
  entranceOffset: 12,
  pressScale: 0.97,
} as const;

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReducedMotion(enabled);
      })
      .catch((error: unknown) => {
        console.warn('Could not read the reduced-motion preference:', error);
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

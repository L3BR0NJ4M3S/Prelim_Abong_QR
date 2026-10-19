import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type ViewProps } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { MOTION, useReducedMotion } from '@/lib/motion';

type MotionViewProps = ViewProps & {
  children: ReactNode;
  delay?: number;
  duration?: number;
  offset?: number;
  scaleFrom?: number;
};

export default function MotionView({
  children,
  delay = 0,
  duration = MOTION.interface,
  offset = MOTION.entranceOffset,
  scaleFrom = 1,
  style,
  ...props
}: MotionViewProps) {
  const reducedMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isFocused) {
      progress.stopAnimation();
      if (hasAnimated.current || reducedMotion) progress.setValue(1);
      return;
    }

    if (reducedMotion || hasAnimated.current) {
      progress.stopAnimation();
      progress.setValue(1);
      hasAnimated.current = true;
      return;
    }

    progress.setValue(0);
    hasAnimated.current = true;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, duration, isFocused, progress, reducedMotion]);

  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [scaleFrom, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type ViewProps } from 'react-native';

import { MOTION, useReducedMotion } from '@/lib/motion';

type MotionViewProps = ViewProps & {
  children: ReactNode;
  delay?: number;
  duration?: number;
  offset?: number;
};

export default function MotionView({
  children,
  delay = 0,
  duration = MOTION.interface,
  offset = MOTION.entranceOffset,
  style,
  ...props
}: MotionViewProps) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.stopAnimation();
      progress.setValue(1);
      return;
    }

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, duration, progress, reducedMotion]);

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
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type ViewProps } from 'react-native';

import { MOTION, useReducedMotion } from '@/lib/motion';

type MotionShakeProps = ViewProps & {
  children: ReactNode;
  trigger: string | number | null;
};

export default function MotionShake({
  children,
  trigger,
  style,
  ...props
}: MotionShakeProps) {
  const reducedMotion = useReducedMotion();
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!trigger || reducedMotion) {
      shake.setValue(0);
      return;
    }

    const animation = Animated.sequence([
      Animated.timing(shake, {
        toValue: 1,
        duration: MOTION.press,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: MOTION.press,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, shake, trigger]);

  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          transform: [
            {
              translateX: shake.interpolate({
                inputRange: [0, 0.25, 0.5, 0.75, 1],
                outputRange: [0, -5, 5, -3, 0],
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

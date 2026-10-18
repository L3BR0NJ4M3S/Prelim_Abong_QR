import { useRef, type ComponentProps } from 'react';
import { Animated, Pressable } from 'react-native';

import { MOTION, useReducedMotion } from '@/lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type MotionPressableProps = ComponentProps<typeof Pressable>;

export default function MotionPressable({
  onPressIn,
  onPressOut,
  style,
  ...props
}: MotionPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  const animateScale = (value: number) => {
    Animated.timing(scale, {
      toValue: reducedMotion ? 1 : value,
      duration: MOTION.press,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        animateScale(MOTION.pressScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateScale(1);
        onPressOut?.(event);
      }}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        { transform: [{ scale }] },
      ]}
    />
  );
}

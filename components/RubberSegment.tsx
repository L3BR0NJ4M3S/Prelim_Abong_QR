import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { COLORS } from '@/constants/colors';

const INSET = 3;

type Props = {
  items: readonly string[];
  icons?: Partial<Record<string, keyof typeof Ionicons.glyphMap>>;
  value: string;
  onChange: (value: string, index: number) => void;
  style?: StyleProp<ViewStyle>;
};

export default function RubberSegment({ items, icons, value, onChange, style }: Props) {
  const selectedIndex = Math.max(0, items.indexOf(value));
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const selectedIndexRef = useRef(selectedIndex);
  const dragStartIndex = useRef(selectedIndex);
  const trackWidth = useRef(0);
  const thumbPosition = useRef(new Animated.Value(0)).current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  selectedIndexRef.current = selectedIndex;
  const slotCount = Math.max(items.length, 1);

  useEffect(() => {
    const slotWidth = (trackWidth.current - INSET * 2) / slotCount;
    if (slotWidth > 0) {
      Animated.spring(thumbPosition, {
        toValue: selectedIndex * slotWidth,
        useNativeDriver: Platform.OS !== 'web',
        friction: 7,
        tension: 90,
      }).start();
    }
  }, [selectedIndex, slotCount, thumbPosition]);

  const selectIndex = (index: number, animate = true) => {
    const nextIndex = Math.max(0, Math.min(slotCount - 1, index));
    if (nextIndex === selectedIndexRef.current) return;

    selectedIndexRef.current = nextIndex;
    onChangeRef.current(items[nextIndex], nextIndex);

    const slotWidth = (trackWidth.current - INSET * 2) / slotCount;
    const toValue = nextIndex * slotWidth;
    if (animate && trackWidth.current > 0) {
      Animated.spring(thumbPosition, {
        toValue,
        useNativeDriver: Platform.OS !== 'web',
        friction: 7,
        tension: 90,
      }).start();
    } else {
      thumbPosition.setValue(toValue);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        dragStartIndex.current = selectedIndexRef.current;
      },
      onPanResponderMove: (_event, gesture) => {
        const slotWidth = (trackWidth.current - INSET * 2) / slotCount;
        if (slotWidth <= 0) return;
        const dragIndex = Math.round(
          dragStartIndex.current + gesture.dx / slotWidth
        );
        selectIndex(dragIndex);
      },
    })
  ).current;

  const handleLayout = (event: LayoutChangeEvent) => {
    trackWidth.current = event.nativeEvent.layout.width;
    setMeasuredWidth(trackWidth.current);
    const slotWidth = (trackWidth.current - INSET * 2) / slotCount;
    thumbPosition.setValue(selectedIndexRef.current * slotWidth);
  };

  return (
    <View
      {...panResponder.panHandlers}
      onLayout={handleLayout}
      style={[styles.track, style]}
      accessibilityRole="tablist"
      accessibilityLabel="Main navigation"
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            width: Math.max(0, (measuredWidth - INSET * 2) / slotCount),
            transform: [{ translateX: thumbPosition }],
          },
        ]}
      />
      {items.map((item, index) => {
        const selected = value === item;
        return (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${item}${selected ? ', selected' : ''}`}
            onPress={() => selectIndex(index)}
            style={styles.option}
          >
            <View style={styles.optionContent}>
              {icons?.[item] ? (
                <Ionicons
                  name={icons[item]}
                  size={21}
                  color={selected ? COLORS.textOnPrimary : COLORS.textSecondary}
                />
              ) : (
                <Text style={[styles.optionText, selected && styles.selectedText]}>
                  {item}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 48,
    width: '100%',
    flexDirection: 'row',
    position: 'relative',
    overflow: 'hidden',
    padding: INSET,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 2,
  },
  thumb: {
    position: 'absolute',
    left: INSET,
    top: INSET,
    bottom: INSET,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  option: {
    flex: 1,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  optionText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedText: {
    color: COLORS.textOnPrimary,
  },
});

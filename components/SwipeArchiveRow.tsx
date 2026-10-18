import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';

const ACTION_WIDTH = 176;
const SINGLE_ACTION_WIDTH = ACTION_WIDTH / 2;

type Props = {
  children: React.ReactNode;
  actionLabel: 'Archive' | 'Restore';
  onAction: () => void;
  onDelete: () => void;
};

export default function SwipeArchiveRow({
  children,
  actionLabel,
  onAction,
  onDelete,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const actionRef = useRef(onAction);
  actionRef.current = onAction;
  const deleteRef = useRef(onDelete);
  deleteRef.current = onDelete;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
      onPanResponderMove: (_event, gesture) => {
        translateX.setValue(Math.max(-ACTION_WIDTH, Math.min(0, gesture.dx)));
      },
      onPanResponderRelease: (_event, gesture) => {
        const shouldOpen = gesture.dx < -ACTION_WIDTH / 2 || gesture.vx < -0.45;
        Animated.spring(translateX, {
          toValue: shouldOpen ? -ACTION_WIDTH : 0,
          useNativeDriver: Platform.OS !== 'web',
          friction: 9,
          tension: 70,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: Platform.OS !== 'web',
          friction: 9,
          tension: 70,
        }).start();
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel} attendance record`}
          onPress={() => {
            actionRef.current();
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: Platform.OS !== 'web',
              friction: 9,
              tension: 70,
            }).start();
          }}
          style={[styles.action, styles.archiveAction]}
        >
          <Ionicons
            name={actionLabel === 'Archive' ? 'archive-outline' : 'arrow-undo-outline'}
            size={20}
            color={COLORS.textOnPrimary}
          />
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete attendance record"
          onPress={() => {
            deleteRef.current();
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: Platform.OS !== 'web',
              friction: 9,
              tension: 70,
            }).start();
          }}
          style={[styles.action, styles.deleteAction]}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.textOnPrimary} />
          <Text style={styles.actionLabel}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.row, { transform: [{ translateX }] }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  actions: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    flexDirection: 'row',
  },
  action: {
    width: SINGLE_ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  archiveAction: {
    backgroundColor: COLORS.primary,
  },
  deleteAction: {
    backgroundColor: COLORS.danger,
  },
  actionLabel: {
    color: COLORS.textOnPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  row: {
    backgroundColor: COLORS.card,
  },
});

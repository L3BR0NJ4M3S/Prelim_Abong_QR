import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import MotionPressable from '@/components/MotionPressable';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: 'primary';
  disabled?: boolean;
  onPress: () => void;
};

export default function AppButton({
  title,
  icon,
  theme,
  disabled = false,
  onPress,
}: Props) {
  const isPrimary = theme === 'primary';

  if (isPrimary) {
    return (
      <View style={styles.buttonOuter}>
        <MotionPressable
          style={({ pressed }) => [
            styles.buttonInner,
            styles.primaryButton,
            { opacity: disabled ? 0.5 : pressed ? 0.86 : 1 },
          ]}
          onPress={disabled ? undefined : onPress}
          disabled={disabled}
        >
          <Ionicons
            name={icon}
            size={22}
            color={COLORS.textOnPrimary}
            style={styles.icon}
          />
          <Text style={[styles.label, styles.primaryLabel]}>{title}</Text>
        </MotionPressable>
      </View>
    );
  }

  return (
    <View style={styles.buttonOuter}>
      <MotionPressable
        style={({ pressed }) => [
          styles.buttonInner,
          styles.secondaryButton,
          { opacity: disabled ? 0.5 : pressed ? 0.78 : 1 },
        ]}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
      >
        <Ionicons
          name={icon}
          size={22}
          color={COLORS.textPrimary}
          style={styles.icon}
        />
        <Text style={styles.label}>{title}</Text>
      </MotionPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonOuter: {
    width: '100%',
    marginBottom: 14,
  },
  buttonInner: {
    borderRadius: 9,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: '#D8BC7C',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 3,
  },
  secondaryButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  icon: { paddingRight: 10 },
  label: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  primaryLabel: { color: COLORS.textOnPrimary, fontWeight: '700' },
});

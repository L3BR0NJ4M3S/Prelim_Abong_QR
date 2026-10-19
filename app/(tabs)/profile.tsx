import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import AppButton from '@/components/AppButton';
import Ionicons from '@expo/vector-icons/Ionicons';
import MotionView from '@/components/MotionView';
import { COLORS } from '@/constants/colors';
import { signOut, useAuth } from '@/lib/auth';
import { getProfile, updateProfile, type Profile } from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const router = useRouter();

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setDraftName('');
      return;
    }

    const nextProfile = await getProfile(user.id);
    setProfile(nextProfile);
    setDraftName(nextProfile?.full_name ?? '');
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const handleSaveName = async () => {
    if (!user) return;

    const trimmed = draftName.trim();
    setSaving(true);

    const { error } = await updateProfile(user.id, { full_name: trimmed });
    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    setProfile((current) =>
      current ? { ...current, full_name: trimmed } : current
    );
    setEditing(false);
  };

  const handleSignOut = async () => {
    setLoading(true);

    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <MotionView duration={340}>
        <Text style={styles.title}>My Profile</Text>
      </MotionView>

      {user && (
        <>
        <MotionView style={styles.avatar} delay={35} offset={0} scaleFrom={0.9} duration={360}>
          <Ionicons name="person-outline" size={42} color={COLORS.workflowAccent} />
        </MotionView>
        <MotionView delay={100} duration={360}>
        <View style={styles.infoCard}>
          {profile?.role === 'teacher' ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Teacher</Text>
            </View>
          ) : (
            <View style={[styles.roleBadge, styles.roleBadgeStudent]}>
              <Text style={styles.roleBadgeText}>Student</Text>
            </View>
          )}

          <Text style={styles.label}>Name</Text>
          {editing ? (
            <View style={styles.nameEditRow}>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.workflowMuted}
                style={styles.nameInput}
              />
              <Pressable style={styles.saveButton} onPress={handleSaveName}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditing(true)} style={styles.nameRow}>
              <Text style={styles.value}>{profile?.full_name || 'Tap to add your name'}</Text>
              <Text style={styles.editHint}>Edit</Text>
            </Pressable>
          )}

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email}</Text>

          <Text style={styles.label}>User ID</Text>
          <Text style={styles.valueSmall}>{user.id}</Text>
        </View>
        </MotionView>
        </>
      )}

      <MotionView delay={180}>
        <AppButton
          title="Sign Out"
          icon="log-out-outline"
          onPress={() => setConfirmingSignOut(true)}
          disabled={loading}
        />
      </MotionView>

      <Modal
        visible={confirmingSignOut}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmingSignOut(false)}
      >
        <View style={styles.modalOverlay}>
          {confirmingSignOut && (
          <MotionView style={styles.confirmationCard} offset={0} scaleFrom={0.96} duration={240}>
            <Text style={styles.confirmationTitle}>Leave your archive?</Text>
            <Text style={styles.confirmationText}>You can sign back in at any time.</Text>
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmingSignOut(false)}
                style={[styles.confirmationButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Stay</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setConfirmingSignOut(false);
                  void handleSignOut();
                }}
                style={[styles.confirmationButton, styles.signOutButton]}
              >
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </Pressable>
            </View>
          </MotionView>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  avatar: {
    width: 78,
    height: 78,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 39,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    backgroundColor: COLORS.workflowSurface,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: COLORS.workflowSurface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.workflowSurfaceRaised,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  roleBadgeStudent: {
    backgroundColor: '#E7EBD9',
  },
  roleBadgeText: {
    color: COLORS.workflowAccent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.workflowMuted,
    marginBottom: 4,
    marginTop: 8,
  },
  value: {
    fontSize: 15,
    color: COLORS.workflowText,
    fontWeight: '500',
  },
  valueSmall: {
    fontSize: 11,
    color: COLORS.workflowMuted,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editHint: {
    color: COLORS.workflowAccent,
    fontSize: 12,
    fontWeight: '600',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    backgroundColor: COLORS.workflowSurfaceRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.workflowText,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveButtonText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  confirmationCard: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    borderRadius: 14,
    backgroundColor: COLORS.workflowSurface,
  },
  confirmationTitle: {
    color: COLORS.workflowText,
    fontSize: 18,
    fontWeight: '700',
  },
  confirmationText: {
    color: COLORS.workflowMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  confirmationButton: {
    minHeight: 42,
    minWidth: 88,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  signOutButton: {
    backgroundColor: COLORS.danger,
  },
  cancelButtonText: {
    color: COLORS.workflowText,
    fontSize: 14,
    fontWeight: '600',
  },
  signOutButtonText: {
    color: COLORS.workflowSurface,
    fontSize: 14,
    fontWeight: '700',
  },
});

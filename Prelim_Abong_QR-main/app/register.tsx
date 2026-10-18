import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import MotionShake from '@/components/MotionShake';
import MotionView from '@/components/MotionView';
import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';
import { MOTION } from '@/lib/motion';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Full name, email, and password are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await signUp(email.trim(), password, {
        full_name: fullName.trim(),
      });

      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        router.replace('/(tabs)');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <MotionView style={styles.headerContainer} duration={MOTION.screen}>
              <Header title="QR Attendance" />
            </MotionView>

            <MotionView delay={50}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Register to start recording attendance</Text>
            </MotionView>

            {success ? (
              <MotionView duration={MOTION.confirmation}>
              <View style={styles.successContainer}>
                <Text style={styles.successTitle}>Check your email!</Text>
                <Text style={styles.successText}>
                  We sent a confirmation link to {email}. Click the link to verify your
                  account, then come back and sign in.
                </Text>
                <Link href="/login" style={styles.link}>
                  Back to Sign In
                </Link>
              </View>
              </MotionView>
            ) : (
              <MotionView delay={110} duration={MOTION.screen}>
              <View style={styles.form}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your full name"
                  placeholderTextColor={COLORS.workflowMuted}
                  editable={!loading}
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your.email@school.edu"
                  placeholderTextColor={COLORS.workflowMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />

                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordField}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="At least 6 characters"
                    placeholderTextColor={COLORS.workflowMuted}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    accessibilityState={{ selected: showPassword }}
                    onPress={() => setShowPassword((visible) => !visible)}
                    style={styles.passwordToggle}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={21}
                      color={COLORS.workflowMuted}
                    />
                  </Pressable>
                </View>

                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.passwordField}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter your password"
                    placeholderTextColor={COLORS.workflowMuted}
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showConfirmPassword ? 'Hide password' : 'Show password'
                    }
                    accessibilityState={{ selected: showConfirmPassword }}
                    onPress={() => setShowConfirmPassword((visible) => !visible)}
                    style={styles.passwordToggle}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={21}
                      color={COLORS.workflowMuted}
                    />
                  </Pressable>
                </View>

                {error && (
                  <MotionShake trigger={error}>
                    <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
                  </MotionShake>
                )}

                {loading ? (
                  <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
                ) : (
                  <AppButton
                    theme="primary"
                    title="Sign Up"
                    icon="person-add-outline"
                    onPress={handleRegister}
                  />
                )}
              </View>
              </MotionView>
            )}

            {!success && (
              <MotionView delay={180}>
                <Link href="/login" style={styles.link}>
                  Already have an account? Sign In
                </Link>
              </MotionView>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'left',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'left',
    lineHeight: 21,
    marginBottom: 32,
  },
  form: {
    marginBottom: 24,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    backgroundColor: COLORS.workflowSurface,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.workflowText,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.workflowSurfaceRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.workflowText,
  },
  passwordField: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 52,
  },
  passwordToggle: {
    position: 'absolute',
    right: 8,
    minWidth: 40,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: 14,
    color: COLORS.workflowDanger,
    textAlign: 'left',
    marginTop: 12,
    marginBottom: 4,
  },
  loader: {
    marginVertical: 16,
  },
  link: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.workflowSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.workflowText,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: COLORS.workflowMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
});

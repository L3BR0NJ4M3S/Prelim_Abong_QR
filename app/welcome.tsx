import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import MotionView from '@/components/MotionView';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { completeOnboarding, hasCompletedOnboarding } from '@/lib/onboarding';
import { MOTION, useReducedMotion } from '@/lib/motion';

const PAGES = [
  {
    eyebrow: 'THE SCHOOL JOURNAL',
    title: 'Every Event Has a Story.',
    body: 'Keep school gatherings, milestones, and shared moments together in one trusted place.',
    icon: 'book-outline' as const,
    detail: 'A RECORD OF EVERY OCCASION',
  },
  {
    eyebrow: 'THE ATTENDANCE SEAL',
    title: 'Scan. Attend. Record.',
    body: 'Check in with a secure event QR code. Your attendance is verified and recorded in moments.',
    icon: 'qr-code-outline' as const,
    detail: 'SECURE CHECK-IN, WITHOUT THE WAIT',
  },
  {
    eyebrow: 'YOUR PERSONAL ARCHIVE',
    title: 'Be Part of Every Moment.',
    body: 'Find upcoming events and revisit your personal attendance history whenever you need it.',
    icon: 'time-outline' as const,
    detail: 'EVERY EVENT COUNTS',
  },
] as const;

type Stage = 'splash' | 'onboarding';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>('splash');
  const [pageIndex, setPageIndex] = useState(0);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const pageTurn = useRef(new Animated.Value(1)).current;
  const emblemRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (authLoading || session) return;
    let active = true;
    let splashTimer: ReturnType<typeof setTimeout> | undefined;

    void hasCompletedOnboarding()
      .then((completed) => {
        if (!active) return;
        setChecking(false);
        if (completed) {
          router.replace('/login');
          return;
        }

        splashTimer = setTimeout(() => setStage('onboarding'), reducedMotion ? 0 : 550);
        if (!reducedMotion) {
          Animated.timing(emblemRotation, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      })
      .catch((error: unknown) => {
        console.error('Could not read onboarding completion:', error);
        if (active) {
          setChecking(false);
          setStorageError('Your introduction could not be loaded from saved preferences.');
          setStage('onboarding');
        }
      });

    return () => {
      active = false;
      if (splashTimer) clearTimeout(splashTimer);
      emblemRotation.stopAnimation();
    };
  }, [authLoading, emblemRotation, reducedMotion, router, session]);

  useEffect(() => {
    if (stage !== 'onboarding' || reducedMotion) {
      pageTurn.setValue(1);
      return;
    }

    pageTurn.setValue(0);
    const animation = Animated.timing(pageTurn, {
      toValue: 1,
      duration: MOTION.screen,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [pageIndex, pageTurn, reducedMotion, stage]);

  const finishOnboarding = async () => {
    if (saving) return;
    setSaving(true);
    setStorageError(null);
    try {
      await completeOnboarding();
    } catch (error) {
      console.error('Could not save onboarding completion:', error);
      setStorageError('Could not save this preference. You can still continue.');
    } finally {
      setSaving(false);
      router.replace('/login');
    }
  };

  const showNextPage = () => {
    if (pageIndex === PAGES.length - 1) {
      void finishOnboarding();
      return;
    }

    if (reducedMotion) {
      setPageIndex((current) => current + 1);
      return;
    }

    Animated.timing(pageTurn, {
      toValue: 0,
      duration: MOTION.interface,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPageIndex((current) => current + 1);
    });
  };

  const page = PAGES[pageIndex];
  const rotate = pageTurn.interpolate({
    inputRange: [0, 1],
    outputRange: ['-9deg', '0deg'],
  });
  const splashRotate = emblemRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['-45deg', '0deg'],
  });

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.ornamentTop} />
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 },
        ]}
        showsVerticalScrollIndicator={false}
      >
      {stage === 'splash' || checking ? (
        <View style={styles.splashContent}>
          <Animated.View style={[styles.seal, { transform: [{ rotate: splashRotate }] }]}>
            <Ionicons name="compass-outline" size={54} color={COLORS.primary} />
            <View style={styles.sealCenter}>
              <Ionicons name="qr-code" size={26} color={COLORS.workflowSurface} />
            </View>
          </Animated.View>
          <Text style={styles.brand}>QR-ATT</Text>
          <Text style={styles.tagline}>SCHOOL EVENT ATTENDANCE</Text>
          <View style={styles.goldRule} />
          <Text style={styles.splashMotto}>Every Event Counts.</Text>
        </View>
      ) : (
        <>
          <MotionView style={styles.brandHeader} duration={MOTION.screen}>
            <Text style={styles.brandSmall}>QR-ATT</Text>
            <Text style={styles.brandCaption}>EVERY EVENT COUNTS</Text>
          </MotionView>

          <Animated.View
            key={pageIndex}
            style={[
              styles.journalPage,
              {
                opacity: pageTurn,
                transform: [
                  { perspective: 900 },
                  { rotateY: rotate },
                  {
                    translateX: pageTurn.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.pageRule}>
              <View style={styles.ruleLine} />
              <Ionicons name="sparkles-outline" size={15} color={COLORS.workflowAccent} />
              <View style={styles.ruleLine} />
            </View>
            <Text style={styles.eyebrow}>{page.eyebrow}</Text>
            <View style={styles.illustration}>
              <View style={styles.illustrationRing}>
                <Ionicons name={page.icon} size={56} color={COLORS.workflowAccent} />
              </View>
              <View style={styles.illustrationStamp}>
                <Ionicons name="school-outline" size={20} color={COLORS.workflowMuted} />
              </View>
            </View>
            <Text style={styles.pageTitle}>{page.title}</Text>
            <Text style={styles.pageBody}>{page.body}</Text>
            <Text style={styles.pageDetail}>{page.detail}</Text>
          </Animated.View>

          <View style={styles.footer}>
            <View style={styles.progress}>
              {PAGES.map((item, index) => (
                <View
                  key={item.eyebrow}
                  style={[styles.progressMark, index === pageIndex && styles.progressMarkActive]}
                />
              ))}
            </View>

            <AppButton
              theme="primary"
              title={saving ? 'Opening your journal...' : pageIndex === PAGES.length - 1 ? 'Get Started' : 'Turn the Page'}
              icon={pageIndex === PAGES.length - 1 ? 'arrow-forward-outline' : 'chevron-forward-outline'}
              onPress={showNextPage}
              disabled={saving}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => void finishOnboarding()}
              disabled={saving}
              style={styles.signInLink}
            >
              <Text style={styles.signInText}>Already have an account? <Text style={styles.signInEmphasis}>Sign in</Text></Text>
            </Pressable>
            {storageError && <Text style={styles.preferenceMessage}>{storageError}</Text>}
          </View>
        </>
      )}
      </ScrollView>
      <View pointerEvents="none" style={styles.ornamentBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 26,
  },
  ornamentTop: {
    position: 'absolute',
    width: 230,
    height: 230,
    top: -155,
    right: -110,
    borderWidth: 1,
    borderColor: 'rgba(201, 164, 95, 0.24)',
    borderRadius: 115,
  },
  ornamentBottom: {
    position: 'absolute',
    width: 180,
    height: 180,
    bottom: -125,
    left: -90,
    borderWidth: 1,
    borderColor: 'rgba(201, 164, 95, 0.2)',
    borderRadius: 90,
  },
  splashContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seal: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  sealCenter: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.workflowAccent,
  },
  brand: {
    color: COLORS.textPrimary,
    fontFamily: 'Georgia',
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: 5,
  },
  tagline: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
    marginTop: 8,
  },
  goldRule: {
    width: 42,
    height: 1,
    backgroundColor: COLORS.primary,
    marginVertical: 20,
  },
  splashMotto: {
    color: COLORS.textSecondary,
    fontFamily: 'Georgia',
    fontSize: 17,
    fontStyle: 'italic',
  },
  brandHeader: {
    alignItems: 'center',
    marginTop: 8,
  },
  brandSmall: {
    color: COLORS.textPrimary,
    fontFamily: 'Georgia',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 3,
  },
  brandCaption: {
    color: COLORS.primary,
    fontSize: 9,
    letterSpacing: 1.8,
    marginTop: 4,
  },
  journalPage: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 25,
    alignItems: 'center',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    backgroundColor: COLORS.workflowSurface,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  pageRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginBottom: 20,
  },
  ruleLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.workflowBorder,
    opacity: 0.65,
  },
  eyebrow: {
    color: COLORS.workflowAccent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  illustration: {
    width: 146,
    height: 146,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  illustrationRing: {
    width: 122,
    height: 122,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 61,
    borderColor: COLORS.workflowBorder,
    backgroundColor: COLORS.workflowSurfaceRaised,
  },
  illustrationStamp: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    backgroundColor: COLORS.workflowSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    color: COLORS.workflowText,
    fontFamily: 'Georgia',
    fontSize: 27,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  pageBody: {
    color: COLORS.workflowMuted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 330,
  },
  pageDetail: {
    color: COLORS.workflowAccent,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '700',
    marginTop: 22,
  },
  footer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingBottom: 8,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  progressMark: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  progressMarkActive: {
    width: 24,
    backgroundColor: COLORS.primary,
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  signInText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  signInEmphasis: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  preferenceMessage: {
    color: COLORS.warning,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
});

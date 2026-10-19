import { CameraView, useCameraPermissions } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import AppButton from '@/components/AppButton';
import MotionView from '@/components/MotionView';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { registerAttendance } from '@/lib/attendance';
import { useReducedMotion } from '@/lib/motion';

export default function ScanScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const requestInProgress = useRef(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const reducedMotion = useReducedMotion();
  const scanProgress = useRef(new Animated.Value(0)).current;
  const framePulse = useRef(new Animated.Value(0)).current;
  const resultProgress = useRef(new Animated.Value(0)).current;
  const highlightProgress = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => {
        setScreenFocused(false);
      };
    }, [])
  );

  useEffect(() => {
    const scanning = screenFocused && !scanned && !busy && !reducedMotion;
    if (!scanning) {
      scanProgress.stopAnimation();
      framePulse.stopAnimation();
      scanProgress.setValue(0);
      framePulse.setValue(0);
      return;
    }

    const lineAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanProgress, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scanProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(framePulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(framePulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    lineAnimation.start();
    pulseAnimation.start();
    return () => {
      lineAnimation.stop();
      pulseAnimation.stop();
    };
  }, [busy, framePulse, reducedMotion, scanProgress, scanned, screenFocused]);

  useEffect(() => {
    resultProgress.stopAnimation();
    highlightProgress.stopAnimation();
    resultProgress.setValue(0);
    highlightProgress.setValue(0);

    if (!scanned || busy || !message || reducedMotion) {
      if (reducedMotion && scanned && !busy && message) {
        resultProgress.setValue(1);
      }
      return;
    }

    const feedbackAnimation = Animated.parallel([
      Animated.timing(resultProgress, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(highlightProgress, {
          toValue: 1,
          duration: 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(highlightProgress, {
          toValue: 0,
          duration: 650,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);
    feedbackAnimation.start();
    return () => feedbackAnimation.stop();
  }, [busy, highlightProgress, message, reducedMotion, resultProgress, scanned]);

  const handleScan = async (data: string) => {
    if (requestInProgress.current || !screenFocused) return;
    requestInProgress.current = true;
    setScanned(true);
    setBusy(true);
    if (!user) {
      setMessage('Please sign in before recording attendance.');
      setSuccess(false);
      setBusy(false);
      requestInProgress.current = false;
      return;
    }

    try {
      const result = await registerAttendance(data);
      setMessage(result.message);
      setSuccess(result.success);
      if (Platform.OS !== 'web') Vibration.vibrate(result.success ? 80 : 180);
    } catch (error) {
      console.error('Failed to record attendance:', error);
      setMessage('Could not record attendance. Please try again.');
      setSuccess(false);
    } finally {
      setBusy(false);
      requestInProgress.current = false;
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    void handleScan(data);
  };

  const handleScanAgain = () => {
    if (requestInProgress.current) return;
    setScanned(false);
    setMessage(null);
    setSuccess(false);
  };

  if (!permission) {
    return (
      <View style={styles.container} />
    );
  }

  if (!permission.granted) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.permissionContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.permissionCard}>
          <Text style={styles.title}>Camera Permission Needed</Text>
          <Text style={styles.subtitle}>
            Camera access is used only to scan event attendance QR codes.
          </Text>
          <AppButton
            theme="primary"
            title="Grant Permission"
            icon="camera"
            onPress={requestPermission}
          />
          {Platform.OS !== 'web' && !permission.canAskAgain && (
            <AppButton
              title="Open Settings"
              icon="settings-outline"
              onPress={() => void Linking.openSettings()}
            />
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torchEnabled && Platform.OS !== 'web'}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned || !screenFocused ? undefined : handleBarcodeScanned}
      />

      {!scanned && !busy && screenFocused && (
        <View pointerEvents="none" style={styles.scannerOverlay}>
          <Animated.View
            style={[
              styles.scanFrame,
              {
                opacity: framePulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.62, 1],
                }),
              },
            ]}
          >
            <View style={[styles.frameCorner, styles.frameTopLeft]} />
            <View style={[styles.frameCorner, styles.frameTopRight]} />
            <View style={[styles.frameCorner, styles.frameBottomLeft]} />
            <View style={[styles.frameCorner, styles.frameBottomRight]} />
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [
                    {
                      translateY: scanProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 232],
                      }),
                    },
                  ],
                },
              ]}
            />
          </Animated.View>
          <View style={styles.scanningIndicator}>
            <Ionicons name="scan-outline" size={15} color={COLORS.workflowAccent} />
            <Text style={styles.scanningText}>SCANNING LIVE</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.overlay}
        contentContainerStyle={styles.overlayContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {Platform.OS !== 'web' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={torchEnabled ? 'Turn flashlight off' : 'Turn flashlight on'}
            onPress={() => setTorchEnabled((enabled) => !enabled)}
            style={styles.torchButton}
          >
            <Text style={styles.torchText}>
              {torchEnabled ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
            </Text>
          </Pressable>
        )}
        <Text style={styles.overlayText}>
          {busy ? 'Verifying attendance...' : scanned ? 'QR Code detected!' : 'Point your camera at a QR code'}
        </Text>

        {busy && <ActivityIndicator color={COLORS.workflowAccent} style={styles.processingIndicator} />}

        {scanned && message && (
          <MotionView style={styles.resultRow} offset={0} scaleFrom={0.9} duration={240}>
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                styles.resultHighlight,
                {
                  backgroundColor: success
                    ? 'rgba(82, 116, 91, 0.18)'
                    : 'rgba(184, 74, 74, 0.14)',
                  opacity: highlightProgress,
                },
              ]}
            />
            <Animated.View
              style={{
                opacity: resultProgress,
                transform: [
                  {
                    scale: resultProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.78, 1],
                    }),
                  },
                ],
              }}
            >
              <Ionicons
                name={success ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={success ? COLORS.workflowSuccess : COLORS.workflowDanger}
              />
            </Animated.View>
            <Text accessibilityRole="alert" style={[styles.scanResult, success ? styles.success : styles.error]}>
              {message}
            </Text>
          </MotionView>
        )}

        {scanned && !busy && (
          <AppButton
            theme="primary"
            title="Scan Again"
            icon="refresh"
            onPress={handleScanAgain}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 440,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    backgroundColor: COLORS.workflowSurface,
  },
  permissionContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.workflowText,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.workflowMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 60,
    maxHeight: '56%',
    backgroundColor: COLORS.workflowSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
    overflow: 'hidden',
  },
  overlayContent: {
    alignItems: 'center',
    padding: 16,
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.workflowText,
    marginBottom: 6,
    textAlign: 'center',
  },
  processingIndicator: {
    marginVertical: 8,
  },
  scannerOverlay: {
    position: 'absolute',
    top: '17%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderRadius: 18,
    overflow: 'hidden',
  },
  frameCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: COLORS.workflowAccent,
  },
  frameTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  frameTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  frameBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  frameBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: COLORS.workflowAccent,
    shadowColor: COLORS.workflowAccent,
    shadowOpacity: 0.8,
    shadowRadius: 7,
    elevation: 5,
  },
  scanningIndicator: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: COLORS.workflowSurface,
  },
  scanningText: {
    color: COLORS.workflowAccent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  resultRow: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
  },
  resultHighlight: {
    borderRadius: 8,
  },
  scanResult: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  success: {
    color: COLORS.workflowSuccess,
  },
  error: {
    color: COLORS.workflowDanger,
  },
  torchButton: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.workflowSurfaceRaised,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  torchText: {
    color: COLORS.workflowAccent,
    fontSize: 12,
    fontWeight: '700',
  },
});

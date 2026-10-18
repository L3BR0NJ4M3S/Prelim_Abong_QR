import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { registerAttendance } from '@/lib/attendance';

export default function ScanScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [manualPayload, setManualPayload] = useState('');
  const requestInProgress = useRef(false);
  const [screenFocused, setScreenFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => {
        setScreenFocused(false);
      };
    }, [])
  );

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
    setManualPayload('');
  };

  if (!permission) {
    return (
      <View style={styles.container} />
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
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
          <ManualPayloadEntry
            value={manualPayload}
            onChangeText={setManualPayload}
            onSubmit={() => void handleScan(manualPayload.trim())}
            disabled={!manualPayload.trim() || busy}
          />
          {Platform.OS !== 'web' && !permission.canAskAgain && (
            <AppButton
              title="Open Settings"
              icon="settings-outline"
              onPress={() => void Linking.openSettings()}
            />
          )}
        </View>
      </View>
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

      <View style={styles.overlay}>
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

        {scanned && message && (
          <Text style={[styles.scanResult, success ? styles.success : styles.error]}>
            {message}
          </Text>
        )}

        {!scanned && (
          <ManualPayloadEntry
            value={manualPayload}
            onChangeText={setManualPayload}
            onSubmit={() => void handleScan(manualPayload.trim())}
            disabled={!manualPayload.trim() || busy}
          />
        )}

        {scanned && !busy && (
          <AppButton
            theme="primary"
            title="Scan Again"
            icon="refresh"
            onPress={handleScanAgain}
          />
        )}
      </View>
    </View>
  );
}

type ManualPayloadEntryProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
};

function ManualPayloadEntry({
  value,
  onChangeText,
  onSubmit,
  disabled,
}: ManualPayloadEntryProps) {
  return (
    <View style={styles.manualEntry}>
      <TextInput
        accessibilityLabel="Manual attendance QR payload"
        style={styles.manualInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="Or paste the attendance QR payload"
        placeholderTextColor={COLORS.workflowMuted}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <AppButton
        theme="primary"
        title="Submit Code"
        icon="enter-outline"
        disabled={disabled}
        onPress={onSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
    backgroundColor: COLORS.workflowSurface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.workflowBorder,
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.workflowText,
    marginBottom: 6,
    textAlign: 'center',
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
  manualEntry: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  manualInput: {
    minHeight: 48,
    maxHeight: 100,
    borderColor: COLORS.workflowBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.workflowText,
    backgroundColor: COLORS.workflowSurfaceRaised,
    fontSize: 14,
    marginBottom: 8,
  },
});

import { ScrollView, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';

import { COLORS } from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops! Not Found' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Link href="/" style={styles.button}>
          Go back to Home screen!
        </Link>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  button: { fontSize: 20, textDecorationLine: 'underline', color: COLORS.textPrimary },
});

import { View, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';

<<<<<<< HEAD
import { COLORS } from '@/constants/colors';

=======
>>>>>>> 963e7a25a435e22b8466fff409ec04aa8eda1f84
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops! Not Found' }} />
      <View style={styles.container}>
        <Link href="/" style={styles.button}>
          Go back to Home screen!
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  button: { fontSize: 20, textDecorationLine: 'underline', color: COLORS.textPrimary },
=======
  container: { flex: 1, backgroundColor: '#25292e', justifyContent: 'center', alignItems: 'center' },
  button: { fontSize: 20, textDecorationLine: 'underline', color: '#fff' },
>>>>>>> 963e7a25a435e22b8466fff409ec04aa8eda1f84
});

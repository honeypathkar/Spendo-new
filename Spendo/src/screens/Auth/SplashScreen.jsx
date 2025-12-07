import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../../components/PrimaryButton';
import { themeAssets } from '../../theme';
import { useAuth } from '../../hooks/useAuth';
import Fonts from '../../../assets/fonts';

// Welcome screen (replaces prior splash auto-redirect)
const SplashScreen = () => {
  const navigation = useNavigation();
  const { token, initializing } = useAuth();
  const paperTheme = useTheme();

  useEffect(() => {
    if (!initializing && token) {
      // Token exists, navigate to AppTabs
      navigation.reset({ index: 0, routes: [{ name: 'AppTabs' }] });
    }
  }, [token, initializing, navigation]);

  // Show loading while checking for token
  if (initializing) {
    return (
      <>
        <StatusBar
          barStyle="light-content"
          backgroundColor={"#0b0f1a"}
        />
        <SafeAreaView edges={['top']} style={styles.container}>
          <LinearGradient
            colors={['#0b0f1a', '#0a0f1e', '#070c16']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}>
            <View style={styles.loadingContainer}>
              <Text style={styles.brand}>Spendo</Text>
              <ActivityIndicator size="large" color="#E8F0FF" style={styles.loader} />
            </View>
          </LinearGradient>
        </SafeAreaView>
      </>
    );
  }

  // If token exists, don't show welcome screen (navigation will happen in useEffect)
  if (token) {
    return (
      <>
        <StatusBar
          barStyle="light-content"
          backgroundColor={"#0b0f1a"}
        />
        <SafeAreaView edges={['top']} style={styles.container}>
          <LinearGradient
            colors={['#0b0f1a', '#0a0f1e', '#070c16']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}>
            <View style={styles.loadingContainer}>
              <Text style={styles.brand}>Spendo</Text>
              <ActivityIndicator size="large" color="#E8F0FF" style={styles.loader} />
            </View>
          </LinearGradient>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor={"#0b0f1a"}
      />
      <SafeAreaView edges={['top']} style={styles.container}>
        <LinearGradient
          colors={['#0b0f1a', '#0a0f1e', '#070c16']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}>
          <Text style={styles.brand}>Spendo</Text>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?q=80&w=1600&auto=format&fit=crop',
            }}
            style={styles.hero}
          />
          <View style={styles.copy}>
            <Text style={styles.headline}>Smarter Spending{'\n'}Starts Here.</Text>
          </View>
          <View style={styles.cta}>
            <PrimaryButton title="Sign Up" onPress={() => navigation.navigate('Signup')} style={styles.primary} />
            <View style={styles.spacer} />
            <PrimaryButton title="Login" onPress={() => navigation.navigate('Login')} style={styles.primary} />
          </View>
        </LinearGradient>
      </SafeAreaView>
    </>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  brand: {
    fontSize: 34,
    fontFamily: Fonts.bold,
    color: '#E8F0FF',
    textAlign: 'center',
    marginBottom: 16,
  },
  hero: {
    width: '100%',
    height: 360,
    borderRadius: 8,
    resizeMode: 'cover',
    marginBottom: 28,
  },
  copy: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headline: {
    fontSize: 32,
    lineHeight: 40,
    textAlign: 'center',
    color: '#E8F0FF',
    fontFamily: Fonts.bold,
  },
  cta: {
    marginTop: 'auto',
  },
  primary: {
    borderRadius: 18,
  },
  spacer: {
    height: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    marginTop: 24,
  },
});

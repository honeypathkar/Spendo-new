import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Button, Text } from 'react-native-paper';
import { StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TextInputField from '../../components/TextInputField';
import { UserPlus } from 'lucide-react-native';
import GlobalHeader from '../../components/GlobalHeader';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../hooks/useAuth';
import { themeAssets } from '../../theme';
import Fonts from '../../../assets/fonts';

const SignupScreen = () => {
  const navigation = useNavigation();
  const { register, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [error, setError] = useState(null);

  const handleSignup = async () => {
    try {
      setError(null);
      if (!name.trim() || !email.trim() || !password.trim()) {
        setError('Please fill in all fields.');
        return;
      }
      await register({ name, email, password });
      // Navigation is handled by the AuthContext/AppNavigator based on user state
    } catch (apiError) {
      setError(apiError.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.select({ ios: 'padding', android: undefined })}>
        <LinearGradient
          colors={['#0b0f1a', '#0a0f1e', '#070c16']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}>
        <GlobalHeader
          backgroundColor="transparent"
          // showLeftIcon
          // leftIconColor="#E8F0FF"
          // onLeftIconPress={() => navigation.goBack()}
          renderRightComponent={() => null}
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

          <View style={styles.headerContainer}>
            <View style={styles.iconContainer}>
              <UserPlus color="#3A6FF8" size={32} />
            </View>
            <Text variant="headlineMedium" style={styles.title}>
              Create Account
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Join Spendo to track your expenses effortlessly.
            </Text>
          </View>

          <View style={styles.formContainer}>
            <TextInputField
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              autoCapitalize="words"
            />

            <TextInputField
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInputField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              secureTextEntry
              isSecureVisible={!secureTextEntry}
              onToggleSecureEntry={() => setSecureTextEntry(!secureTextEntry)}
            />

            {error ? (
              <Text variant="bodyMedium" style={styles.errorText}>
                {error}
              </Text>
            ) : null}

            <PrimaryButton
              title="Sign Up"
              onPress={handleSignup}
              loading={loading}
              style={styles.signupButton}
            />
          </View>

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={styles.footerText}>
              Already have an account?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text variant="bodyMedium" style={styles.loginLink}>
                Log In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  keyboardView: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(58, 111, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#F8FAFC',
    fontFamily: Fonts.bold,
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    gap: 16,
  },
  signupButton: {
    marginTop: 8,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    gap: 8,
  },
  footerText: {
    color: '#94A3B8',
  },
  loginLink: {
    color: '#3A6FF8',
    fontFamily: Fonts.bold,
  },
});

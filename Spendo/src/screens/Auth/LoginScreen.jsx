import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  Easing,
  TextInput,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Button, Card, Chip, HelperText, Text } from 'react-native-paper';
import { StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TextInputField from '../../components/TextInputField';
import { Mail, Lock, Sparkles } from 'lucide-react-native';
import GlobalHeader from '../../components/GlobalHeader';
import PrimaryButton from '../../components/PrimaryButton';
import { useAuth } from '../../hooks/useAuth';
import { themeAssets } from '../../theme';
import Fonts from '../../../assets/fonts';

const StageChip = ({ active, icon: Icon, label }) => (
  <Chip
    icon={(props) => <Icon {...props} size={16} />}
    compact
    mode={active ? 'flat' : 'outlined'}
    style={[styles.stageChip, active ? styles.stageChipActive : null]}>
    {label}
  </Chip>
);

const LoginScreen = () => {
  const navigation = useNavigation();
  const { login, requestOtp, verifyOtp, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [error, setError] = useState(null);
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const otpInputRefs = useRef([]);
  const heroPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(heroPulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(heroPulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [heroPulse]);

  const heroTranslate = heroPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    try {
      setError(null);
      if (!email.trim() || !password.trim()) {
        setError('Please enter both email and password.');
        return;
      }
      await login({ email, password });
      navigation.reset({ index: 0, routes: [{ name: 'AppTabs' }] });
    } catch (apiError) {
      setError(apiError.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleSendOtp = async () => {
    try {
      setError(null);
      if (!isValidEmail(email)) {
        setError('Please enter a valid email address.');
        return;
      }
      await requestOtp({ email });
      setOtpSent(true);
      setOtpMode(true);
      // Focus first OTP input after a short delay
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (apiError) {
      setError(apiError.message || 'Failed to send OTP. Please try again.');
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setError(null);
      if (otp.length !== 6) {
        setError('Please enter the complete 6-digit code.');
        return;
      }
      await verifyOtp({ otp, email });
      navigation.reset({ index: 0, routes: [{ name: 'AppTabs' }] });
    } catch (apiError) {
      setError(apiError.message || 'Invalid OTP. Please try again.');
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
          // leftIconColor="#F8FAFC"
          // onLeftIconPress={() => navigation.goBack()}
          renderRightComponent={() => null}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <View style={styles.heroContainer}>
            <Animated.View style={[styles.heroCard, { transform: [{ translateY: heroTranslate }] }]}>
              <Text variant="headlineMedium" style={styles.heroTitle}>
                Welcome Back!
            </Text>
            </Animated.View>
          </View>

          <View style={styles.formCard}>
            <TextInputField
              label="Email"
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                if (otpSent) {
                  setOtpSent(false);
                  setOtpMode(false);
                  setOtp('');
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Enter your email"
              editable={!otpSent}
            />

            {!otpSent ? (
              <>
                <TextInputField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  isSecureVisible={!secureTextEntry}
                  onToggleSecureEntry={() => setSecureTextEntry(!secureTextEntry)}
                  placeholder="Enter your password"
                />

                <View style={styles.forgotPasswordContainer}>
                  <Button mode="text" onPress={() => { }} textColor="#3A6FF8" compact>
                    Forgot Password?
                  </Button>
                </View>

                {error ? (
                  <Text variant="bodyMedium" style={styles.error}>
                    {error}
                  </Text>
                ) : null}

                <PrimaryButton
                  title="Log In"
                  onPress={handleLogin}
                  loading={loading}
                  style={styles.primaryButton}
                  buttonColor="#3A6FF8"
                />

                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <PrimaryButton
                  title="Login with OTP"
                  onPress={handleSendOtp}
                  loading={loading}
                  style={styles.otpButton}
                  buttonColor="#1E293B"
                  disabled={!isValidEmail(email)}
                />
              </>
            ) : (
              <>
                <Text variant="bodyMedium" style={styles.otpInstructions}>
                  Enter the 6-digit code sent to {email}
                </Text>

                <View style={styles.otpContainer}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
              <TextInput
                      key={`otp-${i}`}
                      ref={(ref) => {
                        if (ref) {
                          otpInputRefs.current[i] = ref;
                        }
                      }}
                      value={otp[i] || ''}
                      onChangeText={(val) => {
                        const cleaned = (val || '').replace(/[^0-9]/g, '').slice(0, 1);
                        const newOtp = (otp + '______').slice(0, i) + cleaned + (otp.slice(i + 1) || '');
                        const finalOtp = newOtp.slice(0, 6);
                        setOtp(finalOtp);
                        
                        // Auto-focus next input if digit entered and not last box
                        if (cleaned && i < 5) {
                          otpInputRefs.current[i + 1]?.focus();
                        }
                      }}
                      onKeyPress={({ nativeEvent }) => {
                        // Handle backspace to go to previous input
                        if (nativeEvent.key === 'Backspace' && !otp[i] && i > 0) {
                          otpInputRefs.current[i - 1]?.focus();
                        }
                      }}
                keyboardType="number-pad"
                      maxLength={1}
                      style={styles.otpBox}
                      textAlign="center"
              />
                  ))}
                </View>

            {error ? (
              <Text variant="bodyMedium" style={styles.error}>
                {error}
              </Text>
            ) : null}

                <PrimaryButton
                  title="Verify OTP"
                  onPress={handleVerifyOtp}
              loading={loading}
                  style={styles.primaryButton}
                  buttonColor="#3A6FF8"
                  disabled={otp.length !== 6}
                />

              <Button
                mode="text"
                onPress={() => {
                    setOtpSent(false);
                    setOtpMode(false);
                  setOtp('');
                }}
                  textColor="#3A6FF8"
                  style={styles.backButton}>
                  Back to password login
                </Button>
              </>
            )}
          </View>

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={styles.footerText}>
              Don't have an account?
            </Text>
            <Button compact mode="text" onPress={() => navigation.navigate('Signup')} textColor="#3A6FF8">
              Sign Up
              </Button>
          </View>
      </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;

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
    paddingHorizontal: themeAssets.spacing[5],
    paddingBottom: themeAssets.spacing[6],
    paddingTop: themeAssets.spacing[3],
    gap: themeAssets.spacing[4],
  },
  heroContainer: {
    position: 'relative',
    marginBottom: themeAssets.spacing[4],
  },
  heroCard: {
    paddingHorizontal: themeAssets.spacing[2],
    backgroundColor: 'transparent',
  },
  heroTitle: {
    fontFamily: Fonts.bold,
    color: '#F8FAFC',
  },
  formCard: {
    width: '100%',
    gap: 16,
  },
  passwordContainer: {
    position: 'relative',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: -8,
  },
  primaryButton: {
    marginTop: themeAssets.spacing[2],
    width: '100%',
    borderRadius: 12,
  },
  error: {
    color: '#EF4444',
    marginBottom: themeAssets.spacing[2],
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: themeAssets.spacing[4],
  },
  footerText: {
    color: '#94A3B8',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: themeAssets.spacing[4],
    gap: themeAssets.spacing[2],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: '#94A3B8',
    fontSize: 14,
    paddingHorizontal: themeAssets.spacing[2],
  },
  otpButton: {
    marginTop: 0,
    width: '100%',
    borderRadius: 12,
  },
  otpInstructions: {
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: themeAssets.spacing[3],
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: themeAssets.spacing[3],
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: '#F8FAFC',
    fontSize: 20,
    fontFamily: Fonts.semibold,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  backButton: {
    marginTop: themeAssets.spacing[2],
  },
});

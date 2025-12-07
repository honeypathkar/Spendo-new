import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ToastAndroid } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlobalHeader from '../../components/GlobalHeader';
import { useAuth } from '../../hooks/useAuth';
import { parseApiError } from '../../api/client';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import { themeAssets } from '../../theme';
import Fonts from '../../../assets/fonts';

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { user, loading, updateProfile } = useAuth();

  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setFormValues({
        name: user.name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const updateFormValue = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formValues.name || !formValues.name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Email is not editable, so no validation needed

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await updateProfile({
        name: formValues.name.trim(),
        // Email is not updatable, so don't send it
      });
      
      if (Platform.OS === 'android') {
        ToastAndroid.show('Profile updated successfully', ToastAndroid.LONG);
      }
      
      // Navigate back after a short delay to show toast
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (err) {
      const apiError = parseApiError(err);
      if (Platform.OS === 'android') {
        ToastAndroid.show(apiError.message || 'Failed to update profile', ToastAndroid.LONG);
      }
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <GlobalHeader
        title="Edit Profile"
        titleColor="#F8FAFC"
        backgroundColor="transparent"
        showLeftIcon
        leftIconName="arrow-left"
        leftIconColor="#F8FAFC"
        onLeftIconPress={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.inputSection}>
            <TextInputField
              label="Full Name"
              value={formValues.name}
              onChangeText={(value) => updateFormValue('name', value)}
              placeholder="Enter your full name"
            />
            {errors.name && (
              <Text style={styles.errorText}>{errors.name}</Text>
            )}
          </View>

          <View style={styles.inputSection}>
            <TextInputField
              label="Email"
              value={formValues.email}
              editable={false}
              placeholder="Email cannot be changed"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.disabledHintText}>
              Email cannot be changed
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <PrimaryButton
              title="Save Changes"
              onPress={handleSave}
              loading={loading}
              buttonColor="#3A6FF8"
              style={styles.saveButton}
            />
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  formContainer: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#F8FAFC',
    marginBottom: 24,
  },
  inputSection: {
    marginBottom: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  disabledHintText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: 32,
    marginBottom: 20,
  },
  saveButton: {
    width: '100%',
  },
});


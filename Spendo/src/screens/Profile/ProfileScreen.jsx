import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlobalHeader from '../../components/GlobalHeader';
import { useAuth } from '../../hooks/useAuth';
import { User, Pencil, Wrench, Info, Shield, LogOut, ChevronRight } from 'lucide-react-native';
import Fonts from '../../../assets/fonts';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleLogout = async () => {
    try {
      // Clear token and user data
      await logout();
      // Reset navigation stack and navigate to SplashScreen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Splash' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, reset navigation
      navigation.reset({
        index: 0,
        routes: [{ name: 'Splash' }],
      });
    }
  };

  const MenuItem = ({ icon: Icon, label, onPress, isDestructive = false }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.menuItemPressed
      ]}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.iconContainer, isDestructive && styles.iconContainerDestructive]}>
          <Icon size={20} color={isDestructive ? '#EF4444' : '#1E293B'} />
        </View>
        <Text style={[styles.menuItemLabel, isDestructive && styles.menuItemLabelDestructive]}>
          {label}
        </Text>
      </View>
      {!isDestructive && <ChevronRight size={20} color="#94A3B8" />}
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <GlobalHeader
        title="Profile"
        titleColor="#F8FAFC"
        backgroundColor="transparent"
        showLeftIcon
        leftIconColor="#F8FAFC"
        onLeftIconPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <User size={64} color="#F97316" />
            </View>
            <Text style={styles.userName}>{user?.name || 'User Name'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
              </View>

          <View style={styles.menuContainer}>
            <MenuItem
              icon={Pencil}
              label="Edit Profile"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <MenuItem
              icon={Wrench}
              label="Tools"
              onPress={() => { }}
            />
            <MenuItem
              icon={Info}
              label="About Us"
              onPress={() => { }}
            />
            <MenuItem
              icon={Shield}
              label="Privacy Policy"
              onPress={() => { }}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon={LogOut}
              label="Logout"
              onPress={handleLogout}
              isDestructive
            />
              </View>
      </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  profileCard: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFE4D6', // Light orange background for avatar
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 4,
    borderColor: '#1E293B',
  },
  userName: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#F8FAFC',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 16,
    color: '#94A3B8',
  },
  menuContainer: {
    width: '100%',
    // backgroundColor: '#1E293B',
    // borderRadius: 24,
    // padding: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  menuItemPressed: {
    backgroundColor: '#334155',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerDestructive: {
    backgroundColor: '#FEE2E2',
  },
  menuItemLabel: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: '#F8FAFC',
  },
  menuItemLabelDestructive: {
    color: '#EF4444',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 8,
    marginHorizontal: 16,
  },
});


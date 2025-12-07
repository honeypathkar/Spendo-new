import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StatusBar, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Text,
  useTheme,
} from 'react-native-paper';
import { LineChart, PieChart } from 'react-native-chart-kit';
import GlobalHeader from '../../components/GlobalHeader';
import { useAuth } from '../../hooks/useAuth';
import { apiClient, parseApiError } from '../../api/client';
import { themeAssets } from '../../theme';
import { useBottomBar } from '../../context/BottomBarContext';
import LinearGradient from 'react-native-linear-gradient';
import { TrendingUp, TrendingDown, UserRound } from 'lucide-react-native';
import Fonts from '../../../assets/fonts';
import { SafeAreaView } from 'react-native-safe-area-context';

const formatMonth = (month) => {
  const [year, monthIndex] = month.split('-');
  const date = new Date(Number(year), Number(monthIndex) - 1);
  return date.toLocaleDateString('default', {
    month: 'short',
    year: 'numeric',
  });
};

const HomeScreen = () => {
  const { user, token } = useAuth();
  const theme = useTheme();
  const { colors } = theme;
  const navigation = useNavigation();
  const { hideBottomBar, showBottomBar } = useBottomBar();
  const screenWidth = Dimensions.get('window').width;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState();
  const [allTimeSummary, setAllTimeSummary] = useState();

  const chartConfig = useMemo(
    () => {
      return {
        backgroundColor: '#1E293B',
        backgroundGradientFrom: '#1E293B',
        backgroundGradientTo: '#1E293B',
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(58, 111, 248, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
        strokeWidth: 3,
        barPercentage: 0.7,
        useShadowColorFromDataset: false,
        fillShadowGradient: '#3A6FF8',
        fillShadowGradientOpacity: 0.3,
        style: {
          borderRadius: 16,
        },
        propsForDots: {
          r: '5',
          strokeWidth: '3',
          stroke: '#3A6FF8',
        },
        propsForBackgroundLines: {
          strokeDasharray: '',
          stroke: '#334155',
          strokeWidth: 1,
        },
        propsForVerticalLabels: {
          fontSize: 11,
          fontFamily: Fonts.medium,
        },
        propsForHorizontalLabels: {
          fontSize: 11,
          fontFamily: Fonts.medium,
        },
        propsForLabels: {
          fontSize: 12,
          fontFamily: Fonts.medium,
        },
      };
    },
    []
  );

  const fetchCategoryDistribution = useCallback(
    async () => {
      if (!token) {
        return;
      }

      try {
        // Fetch all-time category distribution
        const response = await apiClient.get('/chart/category/all-time');
        const data = response.data?.data;
        // Ensure data is always an array
        setCategoryData(Array.isArray(data) ? data : []);
      } catch (err) {
        const apiError = parseApiError(err);
        setError(apiError.message);
        setCategoryData([]); // Set empty array on error
      }
    },
    [token]
  );

  const fetchDashboardData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [monthlyResponse, trendResponse, allTimeSummaryResponse] = await Promise.all([
        apiClient.get('/chart/monthly'),
        apiClient.get('/chart/trend'),
        apiClient.get('/expenses/summary/all-time').catch(() => ({ data: { summary: null } })),
      ]);

      const months = monthlyResponse.data?.data || [];
      setMonthlyData(Array.isArray(months) ? months : []);

      const trends = trendResponse.data?.data || [];
      setTrendData(Array.isArray(trends) ? trends : []);

      // Set all-time summary, fallback to null if not available
      const summaryData = allTimeSummaryResponse?.data?.summary;
      setAllTimeSummary(summaryData || null);

      // Fetch all-time category distribution
      await fetchCategoryDistribution();
    } catch (err) {
      const apiError = parseApiError(err);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }, [fetchCategoryDistribution, token]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const pieColors = useMemo(
    () => [
      '#3A6FF8', // Blue
      '#F97316', // Orange
      '#22C55E', // Green
      '#EF4444', // Red
      '#A855F7', // Purple
      '#14B8A6', // Teal
    ],
    []
  );

  const lineChartData = useMemo(() => {
    if (!trendData || !Array.isArray(trendData) || trendData.length === 0) {
      return null;
    }

    // Take last 6 months for better visibility
    const recentTrends = trendData.slice(-6);

    const labels = recentTrends.map((item) => {
      if (!item || !item.month) return '';
      const monthLabel = formatMonth(item.month);
      return monthLabel.split(' ')[0]; // Just Month name
    }).filter(Boolean);

    const expenseData = recentTrends.map((item) => item?.totalMoneyOut || 0);
    const incomeData = recentTrends.map((item) => item?.totalMoneyIn || 0);

    // Check if we have valid data
    if (labels.length === 0 || (expenseData.every(v => v === 0) && incomeData.every(v => v === 0))) {
      return null;
    }

    return {
      labels,
      datasets: [
        {
          data: expenseData,
          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red for expenses
          strokeWidth: 3,
          withDots: true,
          withShadow: true,
        },
        {
          data: incomeData,
          color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`, // Green for income
          strokeWidth: 3,
          withDots: true,
          withShadow: true,
        },
      ],
      legend: ['Expense', 'Income'],
    };
  }, [trendData]);

  const pieChartData = useMemo(() => {
    // Always return an array, never undefined
    if (!categoryData || !Array.isArray(categoryData) || categoryData.length === 0) {
      return [];
    }

    try {
      const result = [];
      categoryData.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;
        if (!item.category) return;
        
        const amount = Number(item.totalMoneyOut || item.totalAmount || 0);
        if (amount <= 0) return;
        
        result.push({
          name: String(item.category),
          population: amount,
          color: pieColors[index % pieColors.length] || '#3A6FF8',
          legendFontColor: '#94A3B8',
          legendFontSize: 12,
          legendFontFamily: Fonts.medium,
        });
      });
      
      return result;
    } catch (error) {
      console.error('Error generating pie chart data:', error);
      return [];
    }
  }, [categoryData, pieColors]);

  // Use all-time summary instead of current month data
  const allTimeData = useMemo(() => {
    return {
      moneyIn: allTimeSummary?.totalMoneyIn || 0,
      moneyOut: allTimeSummary?.totalMoneyOut || 0,
    };
  }, [allTimeSummary]);

  if (!token) {
    return (
      <View style={styles.container}>
        <GlobalHeader
          title="Spendo"
          subtitle="Sign in to see your financial overview"
        />
        <View style={styles.centered}>
          <Text variant="titleMedium" style={styles.centeredTitle}>
            You're almost there!
          </Text>
          <Text variant="bodyMedium" style={styles.centeredSubtitle}>
            Head over to the profile tab to log in and unlock your personalized
            insights.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar backgroundColor="#0F172A" barStyle="light-content" />
      <View style={styles.header}>
        <View>
          <Text variant="headlineSmall" style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'User'}</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>Here's your financial overview</Text>
        </View>
        <TouchableOpacity
          style={styles.profileIcon}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}>
          <UserRound size={24} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      {loading && !monthlyData.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator animating size="large" color="#3A6FF8" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => hideBottomBar()}
          onScrollEndDrag={(e) => {
            const { contentOffset } = e.nativeEvent;
            if (contentOffset.y <= 0) {
              showBottomBar();
            }
          }}
          onMomentumScrollEnd={(e) => {
            const { contentOffset } = e.nativeEvent;
            if (contentOffset.y <= 0) {
              showBottomBar();
            }
          }}
          scrollEventThrottle={16}>

          <View style={styles.statsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('MoneyIn')}
              style={{ flex: 1 }}>
              <LinearGradient
                colors={['#1E293B', '#0F172A']}
                style={styles.statCard}
              >
                <Text variant="bodyMedium" style={styles.statLabel}>Total Money In</Text>
                <Text variant="titleLarge" style={styles.statValueIn}>₹{(allTimeData.moneyIn || 0).toLocaleString()}</Text>
                <View style={styles.trendRow}>
                  <TrendingUp size={16} color="#22C55E" />
                  <Text style={styles.trendTextIn}>+12%</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              style={styles.statCard}
            >
              <Text variant="bodyMedium" style={styles.statLabel}>Total Money Out</Text>
              <Text variant="titleLarge" style={styles.statValueOut}>₹{(allTimeData.moneyOut || 0).toLocaleString()}</Text>
              <View style={styles.trendRow}>
                <TrendingDown size={16} color="#EF4444" />
                <Text style={styles.trendTextOut}>-5%</Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.chartCard}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Monthly Snapshot</Text>
            <Text variant="displaySmall" style={styles.netBalance}>
              ₹{((allTimeData.moneyIn || 0) - (allTimeData.moneyOut || 0)).toLocaleString()}
              <Text variant="bodyMedium" style={styles.netBalanceLabel}> Net Balance</Text>
            </Text>

            {lineChartData && lineChartData.labels.length > 0 ? (
              <View style={styles.chartWrapper}>
                <LineChart
                  data={lineChartData}
                  width={screenWidth - 48}
                  height={220}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                  withDots={true}
                  withInnerLines={true}
                  withOuterLines={false}
                  withVerticalLabels={true}
                  withHorizontalLabels={true}
                  segments={4}
                  fromZero={true}
                  yAxisInterval={1}
                  formatYLabel={(value) => {
                    const num = parseInt(value);
                    if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
                    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                    return num.toString();
                  }}
                />
              </View>
            ) : (
              <View style={styles.chartPlaceholder}>
                <Text style={styles.placeholderText}>No trend data available</Text>
                <Text style={styles.placeholderSubtext}>Add expenses to see your spending trends</Text>
              </View>
            )}
          </View>

          <View style={styles.chartCard}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Spending Categories</Text>
            <View style={styles.donutContainer}>
              {pieChartData && 
               Array.isArray(pieChartData) && 
               pieChartData.length > 0 && 
               chartConfig &&
               pieChartData.every(item => item && item.name && typeof item.population === 'number' && item.population > 0) ? (
                <PieChart
                  data={pieChartData}
                  width={screenWidth - 48}
                  height={220}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute={false}
                />
              ) : (
                <View style={styles.chartPlaceholder}>
                  <Text style={styles.placeholderText}>No category data available</Text>
                  <Text style={styles.placeholderSubtext}>Add expenses with categories to see breakdown</Text>
                </View>
              )}
            </View>

            <View style={styles.categoryList}>
              {categoryData && Array.isArray(categoryData) && categoryData.length > 0 ? (
                categoryData.slice(0, 4).map((item, index) => {
                  if (!item || !item.category) return null;
                  const amount = item.totalMoneyOut || item.totalAmount || 0;
                  return (
                    <View key={index} style={styles.categoryRow}>
                      <View style={styles.categoryInfo}>
                        <View style={[styles.dot, { backgroundColor: pieColors[index % pieColors.length] }]} />
                        <Text style={styles.categoryName}>{item.category}</Text>
                      </View>
                      <Text style={styles.categoryAmount}>₹{amount.toLocaleString()}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.placeholderText}>No category data available</Text>
              )}
            </View>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: {
    color: '#F8FAFC',
    fontFamily: Fonts.bold,
  },
  subtitle: {
    color: '#94A3B8',
    fontFamily: Fonts.regular,
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    gap: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statLabel: {
    color: '#94A3B8',
    marginBottom: 8,
    fontFamily: Fonts.regular,
  },
  statValueIn: {
    color: '#F8FAFC',
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  statValueOut: {
    color: '#F8FAFC',
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendTextIn: {
    color: '#22C55E',
    fontSize: 12,
  },
  trendTextOut: {
    color: '#EF4444',
    fontSize: 12,
  },
  chartCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    color: '#F8FAFC',
    marginBottom: 8,
    fontFamily: Fonts.semibold
  },
  netBalance: {
    color: '#F8FAFC',
    fontFamily: Fonts.bold,
    marginBottom: 20,
  },
  netBalanceLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: Fonts.regular
  },
  chartWrapper: {
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  chart: {
    marginLeft: -20,
    borderRadius: 16,
    fontFamily: Fonts.regular
  },
  donutContainer: {
    alignItems: 'center',
  },
  categoryList: {
    marginTop: 20,
    gap: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    color: '#94A3B8',
    fontFamily: Fonts.regular
  },
  categoryAmount: {
    color: '#F8FAFC',
    fontFamily: Fonts.semibold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredTitle: {
    color: '#F8FAFC',
    marginBottom: 8,
  },
  centeredSubtitle: {
    color: '#94A3B8',
    textAlign: 'center',
  },
  placeholderText: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 16,
    fontFamily: Fonts.medium,
  },
  chartPlaceholder: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  placeholderSubtext: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
});

export default HomeScreen;


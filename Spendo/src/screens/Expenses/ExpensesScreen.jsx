import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  FlatList,
  LayoutAnimation,
  StyleSheet,
  View,
  Platform,
  ToastAndroid,
  KeyboardAvoidingView,
  ScrollView,
  UIManager,
  Easing,
  Modal,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button, Card, Chip, Text, useTheme } from 'react-native-paper';
import TextInputField from '../../components/TextInputField';
import BottomSheet from '../../components/BottomSheet';
import PrimaryButton from '../../components/PrimaryButton';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import * as XLSX from 'xlsx';
import RNFS from 'react-native-fs';
import GlobalHeader from '../../components/GlobalHeader';
import { useAuth } from '../../hooks/useAuth';
import { apiClient, parseApiError } from '../../api/client';
import { themeAssets } from '../../theme';
import { useBottomBar } from '../../context/BottomBarContext';
import {
  Plus,
  FileText,
  FileSpreadsheet,
  MessageSquare,
  Search,
  Filter,
  ChevronDown,
  X,
  Pencil,
} from 'lucide-react-native';
import { TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Fonts from '../../../assets/fonts';

const defaultFormState = {
  month: '',
  itemName: '',
  category: '',
  amount: '',
  notes: '',
};

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SkeletonPulse = ({ style }) => {
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animation, {
          toValue: 1,
          duration: 950,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(animation, {
          toValue: 0,
          duration: 950,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      animation.stopAnimation();
    };
  }, [animation]);

  const backgroundColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['#1E293B', '#334155'],
  });

  return (
    <Animated.View style={[styles.skeletonBase, style, { backgroundColor }]} />
  );
};

const AnimatedExpenseCard = ({ index, children, skipAnimation = false }) => {
  const translateY = useRef(new Animated.Value(skipAnimation ? 0 : 24)).current;
  const opacity = useRef(new Animated.Value(skipAnimation ? 1 : 0)).current;

  useEffect(() => {
    if (skipAnimation) {
      // Skip animation for paginated items
      return;
    }

    // Only animate first 10 items with delay, rest animate quickly
    const delay = index < 10 ? index * 30 : 0;
    const duration = index < 10 ? 300 : 150;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: duration - 50,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY, skipAnimation]);

  return (
    <Animated.View style={{ transform: [{ translateY }], opacity }}>
      {children}
    </Animated.View>
  );
};

const ExpensesScreen = () => {
  const { token } = useAuth();
  const theme = useTheme();
  const navigation = useNavigation();
  const { isVisible: isBottomBarVisible, hideBottomBar, showBottomBar } = useBottomBar();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [months, setMonths] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState();
  const [allTimeSummary, setAllTimeSummary] = useState();
  const [comparison, setComparison] = useState();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [formVisible, setFormVisible] = useState(false);
  const [formValues, setFormValues] = useState(defaultFormState);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [fabOpen, setFabOpen] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [categories, setCategories] = useState({
    default: [],
    custom: [],
    all: [],
  });
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const bottomSheetRef = useRef(null);
  const fabMenuSheetRef = useRef(null);
  const filterSheetRef = useRef(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const transformMonthLabel = useCallback(month => {
    const [year, monthIndex] = month.split('-');
    const date = new Date(Number(year), Number(monthIndex) - 1);
    return date.toLocaleDateString('default', {
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Parse month string (like "June 2025") to YYYY-MM format
  const parseMonthToYYYYMM = useCallback(monthString => {
    if (!monthString) return null;

    // Check if already in YYYY-MM format
    const yyyyMMRegex = /^\d{4}-\d{2}$/;
    if (yyyyMMRegex.test(monthString.trim())) {
      return monthString.trim();
    }

    // Try to parse month names like "June 2025", "June2025", "Jun 2025"
    const monthNames = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ];

    const cleanString = monthString.toString().toLowerCase().trim();
    const yearMatch = cleanString.match(/(\d{4})/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

    for (let i = 0; i < monthNames.length; i++) {
      if (cleanString.includes(monthNames[i])) {
        const monthIndex = i >= 12 ? i - 12 : i;
        const month = String(monthIndex + 1).padStart(2, '0');
        return `${year}-${month}`;
      }
    }

    return null;
  }, []);

  const generateMonthOptions = useCallback(() => {
    const options = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Generate last 12 months and next 12 months
    for (let i = -12; i <= 12; i++) {
      const date = new Date(currentYear, currentMonth + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('default', {
        month: 'long',
        year: 'numeric',
      });
      options.push({ key: monthKey, label: monthLabel });
    }
    return options;
  }, []);

  const monthOptions = useMemo(
    () => generateMonthOptions(),
    [generateMonthOptions],
  );

  const fetchExpenses = useCallback(
    async (month = 'All', pageNum = 1, append = false) => {
      try {
        if (pageNum === 1) {
        setLoading(true);
          loadingMoreRef.current = false;
        } else {
          setLoadingMore(true);
          loadingMoreRef.current = true;
        }
        setSelectedMonth(month);

        // Fetch expenses - all time or by month
        const expensesPromise =
          month === 'All'
            ? apiClient.get('/expenses/all', {
                params: { page: pageNum, limit: 20 },
              })
            : apiClient.get(`/expenses/${month}`, {
                params: { page: pageNum, limit: 20 },
              });

        const [expensesResponse, allTimeSummaryResponse] = await Promise.all([
          expensesPromise,
          apiClient
            .get('/expenses/summary/all-time')
            .catch(() => ({ data: { summary: null } })),
        ]);

        // Only use LayoutAnimation for initial load, not for pagination
        if (!append) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        const newExpenses = expensesResponse.data?.expenses || [];
        if (append) {
          setExpenses(prev => [...prev, ...newExpenses]);
        } else {
          setExpenses(newExpenses);
        }
        setAllTimeSummary(allTimeSummaryResponse?.data?.summary || null);

        // Check if there are more expenses - prioritize backend hasMore
        const backendHasMore = expensesResponse.data?.hasMore;
        let hasMoreData = false;

        if (backendHasMore !== undefined) {
          // Use backend's hasMore if available
          hasMoreData = backendHasMore;
        } else {
          // Fallback: check if we got a full page of results
          hasMoreData = newExpenses.length >= 20;
        }

        setHasMore(hasMoreData);
        setPage(pageNum);
        // Update refs for fresh state in callbacks
        pageRef.current = pageNum;
        hasMoreRef.current = hasMoreData;

        // Debug logging
        console.log('Pagination Debug:', {
          page: pageNum,
          received: newExpenses.length,
          hasMore: hasMoreData,
          backendHasMore: backendHasMore,
          total: expensesResponse.data?.total,
          append,
        });

        // Only fetch comparison if a specific month is selected
        if (month !== 'All') {
          const availableMonths = months.length > 0 ? months : [month];
        const currentMonthIndex = availableMonths.indexOf(month);
        if (currentMonthIndex > 0) {
          const previousMonth = availableMonths[currentMonthIndex - 1];
            try {
          const compareResponse = await apiClient.get('/expenses/compare', {
            params: {
              month1: previousMonth,
              month2: month,
            },
          });
          setComparison(compareResponse.data?.comparison);
            } catch (err) {
              setComparison(undefined);
            }
          } else {
            setComparison(undefined);
          }
        } else {
          setComparison(undefined);
        }
      } catch (err) {
        const apiError = parseApiError(err);
        setError(apiError.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [months, selectedMonth],
  );

  const loadMoreExpenses = useCallback(() => {
    // Use refs to get fresh state values
    const currentPage = pageRef.current;
    const currentHasMore = hasMoreRef.current;
    const currentlyLoadingMore = loadingMoreRef.current;

    console.log('loadMoreExpenses called:', {
      currentPage,
      currentHasMore,
      currentlyLoadingMore,
      loading,
      selectedMonth,
      expensesCount: expenses.length,
    });

    if (!currentlyLoadingMore && currentHasMore && !loading) {
      const nextPage = currentPage + 1;
      console.log('Loading page:', nextPage);
      fetchExpenses(selectedMonth, nextPage, true);
    } else {
      console.log('Skipping load more:', {
        currentlyLoadingMore,
        currentHasMore,
        loading,
        reason: currentlyLoadingMore
          ? 'already loading'
          : !currentHasMore
          ? 'no more data'
          : 'initial loading',
      });
    }
  }, [loading, selectedMonth, fetchExpenses, expenses.length]);

  const fetchMonthsAndData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const monthlyResponse = await apiClient.get('/chart/monthly');
      const monthsFetched =
        monthlyResponse.data?.data?.map(item => item.month) || [];

      const sortedMonths = monthsFetched.sort((a, b) => a.localeCompare(b));
      setMonths(sortedMonths);

      // By default, show all expenses (not filtered by month)
      setPage(1);
      setHasMore(true);
      pageRef.current = 1;
      hasMoreRef.current = true;
      await fetchExpenses('All', 1, false);
    } catch (err) {
      const apiError = parseApiError(err);
      setError(apiError.message);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [token, fetchExpenses]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh months list
      const monthlyResponse = await apiClient.get('/chart/monthly');
      const monthsFetched =
        monthlyResponse.data?.data?.map(item => item.month) || [];
      const sortedMonths = monthsFetched.sort((a, b) => a.localeCompare(b));
      setMonths(sortedMonths);

      // Refresh current expenses view
      setPage(1);
      setHasMore(true);
      pageRef.current = 1;
      hasMoreRef.current = true;
      await fetchExpenses(selectedMonth, 1, false);
    } catch (err) {
      const apiError = parseApiError(err);
      setError(apiError.message);
    } finally {
      setRefreshing(false);
    }
  }, [selectedMonth, fetchExpenses]);

  const fetchCategories = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingCategories(true);
      const response = await apiClient.get('/categories');
      setCategories(
        response.data?.data || { default: [], custom: [], all: [] },
      );
    } catch (err) {
      const apiError = parseApiError(err);
      console.warn('Failed to fetch categories:', apiError.message);
    } finally {
      setLoadingCategories(false);
    }
  }, [token]);

  const createCategory = useCallback(
    async categoryName => {
      if (!token || !categoryName.trim() || creatingCategory) return;
      try {
        setCreatingCategory(true);
        await apiClient.post('/categories', { name: categoryName.trim() });
        await fetchCategories();
        setNewCategoryName('');
        setShowAddCategory(false);
      } catch (err) {
        const apiError = parseApiError(err);
        if (Platform.OS === 'android') {
          ToastAndroid.show(
            apiError.message || 'Failed to create category',
            ToastAndroid.LONG,
          );
        }
      } finally {
        setCreatingCategory(false);
      }
    },
    [token, fetchCategories, creatingCategory],
  );

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let isMounted = true;
      let hasFetched = false;

      const loadData = async () => {
        // Prevent multiple simultaneous fetches
        if (hasFetched) return;
        hasFetched = true;

        try {
          // Fetch months list (only if empty)
          if (months.length === 0) {
            const monthlyResponse = await apiClient.get('/chart/monthly');
            const monthsFetched =
              monthlyResponse.data?.data?.map(item => item.month) || [];
            const sortedMonths = monthsFetched.sort((a, b) =>
              a.localeCompare(b),
            );

            if (isMounted) {
              setMonths(sortedMonths);
            }
          }

          // Only fetch expenses if we don't have any or if it's initial load
          if (isMounted && (expenses.length === 0 || initialLoad)) {
            setPage(1);
            setHasMore(true);
            pageRef.current = 1;
            hasMoreRef.current = true;

            // Fetch expenses directly without using fetchExpenses callback to avoid dependency issues
            try {
              setLoading(true);
              const expensesPromise =
                selectedMonth === 'All'
                  ? apiClient.get('/expenses/all', {
                      params: { page: 1, limit: 20 },
                    })
                  : apiClient.get(`/expenses/${selectedMonth}`, {
                      params: { page: 1, limit: 20 },
                    });

              const [expensesResponse, allTimeSummaryResponse] =
                await Promise.all([
                  expensesPromise,
                  apiClient
                    .get('/expenses/summary/all-time')
                    .catch(() => ({ data: { summary: null } })),
                ]);

              if (isMounted) {
                const newExpenses = expensesResponse.data?.expenses || [];
                setExpenses(newExpenses);
                setAllTimeSummary(
                  allTimeSummaryResponse?.data?.summary || null,
                );

                const backendHasMore = expensesResponse.data?.hasMore;
                const hasMoreData =
                  backendHasMore !== undefined
                    ? backendHasMore
                    : newExpenses.length >= 20;
                setHasMore(hasMoreData);
                pageRef.current = 1;
                hasMoreRef.current = hasMoreData;
              }
            } catch (err) {
              if (isMounted) {
                const apiError = parseApiError(err);
                setError(apiError.message);
              }
            } finally {
              if (isMounted) {
                setLoading(false);
                setInitialLoad(false);
              }
            }
          } else if (isMounted) {
            setInitialLoad(false);
          }

          // Fetch categories (only if empty)
          if (categories.all.length === 0) {
            const categoriesResponse = await apiClient.get('/categories');
            if (isMounted) {
              setCategories(
                categoriesResponse.data?.data || {
                  default: [],
                  custom: [],
                  all: [],
                },
              );
            }
          }
        } catch (err) {
          if (isMounted) {
            const apiError = parseApiError(err);
            setError(apiError.message);
          }
        }
      };

      loadData();

      return () => {
        isMounted = false;
      };
    }, [token]), // Only depend on token to prevent constant refetching
  );

  const filteredExpenses = useMemo(() => {
    let list = expenses;
    if (selectedCategory !== 'All') {
      list = list.filter(expense => expense.category === selectedCategory);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      list = list.filter(
        expense =>
          (expense.itemName || expense.category || '')
            .toLowerCase()
            .includes(query) ||
          (expense.category || '').toLowerCase().includes(query) ||
          (expense.notes || '').toLowerCase().includes(query),
      );
    }
    return list;
  }, [expenses, searchQuery, selectedCategory]);

  const expenseCategories = useMemo(() => {
    const unique = new Set(
      expenses.map(expense => expense.category).filter(Boolean),
    );
    return ['All', ...Array.from(unique)];
  }, [expenses]);

  const comparisonKeys = ['moneyIn', 'moneyOut', 'remaining'];

  const comparisonChipStyles = useMemo(
    () =>
      StyleSheet.create({
        positive: {
          backgroundColor: '#1E3A5F',
        },
        negative: {
          backgroundColor: '#5F1E1E',
        },
      }),
    [],
  );

  const handleUploadExcel = useCallback(async () => {
    try {
      setUploading(true);
      setError(null);

      const [pickerResult] = await pick({
        mode: 'open',
        type: [types.xlsx, types.csv, types.plainText],
      });

      if (!pickerResult) {
        return;
      }

      const file = await keepLocalCopy(pickerResult);

      const filePath = file.fileCopyUri || file.uri;
      if (!filePath) {
        throw new Error('Unable to read the selected file');
      }

      const normalizedPath =
        Platform.OS === 'ios' ? filePath.replace('file://', '') : filePath;

      const fileContent = await RNFS.readFile(normalizedPath, 'base64');
      const workbook = XLSX.read(fileContent, { type: 'base64' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (!jsonData.length) {
        throw new Error('No data found in the selected file');
      }

      await apiClient.post('/expenses/upload', {
        expenses: jsonData,
      });

      if (selectedMonth) {
        await fetchExpenses(selectedMonth, 1, false);
      } else {
        await fetchMonthsAndData();
      }
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      const apiError = parseApiError(err);
      setError(apiError.message);
    } finally {
      setUploading(false);
    }
  }, [fetchExpenses, fetchMonthsAndData, months, selectedMonth]);

  const updateFormValue = (key, value) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  const openForm = (expense = null) => {
    if (expense) {
      // Pre-fill form for editing
      setEditingExpenseId(expense._id);
      setFormValues({
        month: expense.month || (selectedMonth !== 'All' ? selectedMonth : ''),
        itemName: expense.itemName || '',
        category: expense.category || '',
        amount: expense.amount?.toString() || '',
        notes: expense.notes || '',
      });
    } else {
      // Reset form for adding new expense
      setEditingExpenseId(null);
      setFormValues(prev => ({
      ...defaultFormState,
        month: selectedMonth !== 'All' ? selectedMonth : prev.month,
      }));
    }
    bottomSheetRef.current?.open();
  };

  const closeForm = useCallback(() => {
    setEditingExpenseId(null);
    setFormValues(defaultFormState);
    // Don't call bottomSheetRef.current?.close() here to avoid circular dependency
    // The BottomSheet will handle closing itself
  }, []);

  const handleFormClose = useCallback(() => {
    // Reset form state when BottomSheet closes
    setEditingExpenseId(null);
    setFormValues(defaultFormState);
  }, []);

  const toggleFab = () => {
    setFabOpen(true);
    fabMenuSheetRef.current?.open();
  };

  const handleAddManually = () => {
    fabMenuSheetRef.current?.close();
    setTimeout(() => {
      setFabOpen(false);
      openForm();
    }, 200);
  };

  const handleImportExcel = () => {
    fabMenuSheetRef.current?.close();
    setTimeout(() => {
      setFabOpen(false);
      navigation.navigate('ExcelUpload');
    }, 200);
  };

  const handleSmsFetch = () => {
    fabMenuSheetRef.current?.close();
    setTimeout(() => {
      setFabOpen(false);
      if (Platform.OS === 'android') {
        ToastAndroid.show('SMS fetch feature coming soon!', ToastAndroid.LONG);
      }
    }, 200);
  };

  const handleAddExpense = async () => {
    try {
      setSavingExpense(true);

      // Parse month to YYYY-MM format if needed
      const parsedMonth = parseMonthToYYYYMM(formValues.month);
      if (!parsedMonth) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Please select a valid month', ToastAndroid.LONG);
        }
        return;
      }

      const payload = {
        month: parsedMonth,
        itemName: formValues.itemName,
        category: formValues.category || '',
        amount: Number(formValues.amount) || 0,
        notes: formValues.notes,
      };

      if (!payload.itemName) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Item name is required', ToastAndroid.LONG);
        }
        return;
      }

      if (editingExpenseId) {
        // Update existing expense
        await apiClient.put(`/expenses/${editingExpenseId}`, payload);
      } else {
        // Create new expense
      await apiClient.post('/expenses', payload);
      }

      // Close the sheet - handleFormClose will reset form state
      bottomSheetRef.current?.close();
      setPage(1);
      setHasMore(true);
      pageRef.current = 1;
      hasMoreRef.current = true;
      // Refresh expenses based on current filter
      await fetchExpenses(selectedMonth, 1, false);
      await fetchMonthsAndData();
    } catch (err) {
      const apiError = parseApiError(err);
      setError(apiError.message);
      if (Platform.OS === 'android') {
        ToastAndroid.show(apiError.message, ToastAndroid.LONG);
      }
    } finally {
      setSavingExpense(false);
    }
  };

  if (!token) {
    return (
      <View style={styles.container}>
        <GlobalHeader
          title="Track expenses effortlessly"
          subtitle="Log in from the Profile tab to manage your spending"
        />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
    <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
      <GlobalHeader
        title="Expenses"
        subtitle={
          selectedMonth === 'All'
            ? 'Showing all expenses'
            : `Showing data for ${transformMonthLabel(selectedMonth)}`
        }
        backgroundColor="transparent"
        titleColor="#F8FAFC"
        subtitleColor="#94A3B8"
      />
      {loading && initialLoad ? (
        <ScrollView contentContainerStyle={styles.skeletonContainer}>
          <Card style={styles.summaryCard}>
            <Card.Content>
              <View style={styles.summaryHeader}>
                <SkeletonPulse style={styles.skeletonTitleShort} />
                <SkeletonPulse style={styles.skeletonButton} />
        </View>
              <View style={styles.summaryGrid}>
                {[0, 1, 2, 3].map(index => (
                  <View
                    key={`summary-skeleton-${index}`}
                    style={styles.summaryItem}
                  >
                    <SkeletonPulse style={styles.skeletonLabel} />
                    <SkeletonPulse style={styles.skeletonValue} />
                  </View>
                ))}
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.comparisonCard}>
            <Card.Content>
              {[0, 1, 2].map(index => (
                <View
                  key={`comparison-skeleton-${index}`}
                  style={styles.comparisonRow}
                >
                  <SkeletonPulse style={styles.skeletonLabelWide} />
                  <View style={styles.comparisonValues}>
                    <SkeletonPulse style={styles.skeletonChipValue} />
                    <SkeletonPulse style={styles.skeletonChip} />
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
          {[0, 1, 2].map(index => (
            <Card key={`list-skeleton-${index}`} style={styles.expenseItem}>
              <Card.Content>
                <SkeletonPulse style={styles.skeletonLabelWide} />
                <SkeletonPulse style={styles.skeletonNotes} />
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={filteredExpenses}
          keyExtractor={item => item._id}
          onEndReached={loadMoreExpenses}
          onEndReachedThreshold={0.2}
          removeClippedSubviews={false}
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
          scrollEventThrottle={16}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreContainer}>
                <Text style={styles.loadMoreText}>Loading more...</Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {error ? (
                <Card style={styles.errorCard}>
                  <Card.Content>
                    <Text variant="titleSmall" style={styles.errorTitle}>
                      Something went wrong
                    </Text>
                    <Text variant="bodyMedium" style={styles.errorText}>
                      {error}
                    </Text>
                    <Button onPress={fetchMonthsAndData}>Retry</Button>
                  </Card.Content>
                </Card>
              ) : null}

              <Card style={styles.summaryCard}>
                <Card.Content>
                  <View style={styles.summaryHeader}>
                    <Text variant="titleMedium" style={styles.summaryTitle}>
                      Summary
                    </Text>
                    <TouchableOpacity
                      style={styles.summaryAddButton}
                      onPress={openForm}
                      activeOpacity={0.7}
                    >
                      <Plus size={18} color="#3A6FF8" />
                      <Text style={styles.summaryAddButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                      <Text variant="labelMedium" style={styles.summaryLabel}>
                        Money In
                      </Text>
                      <Text
                        variant="headlineSmall"
                        style={styles.summaryValueIn}
                      >
                        ₹{allTimeSummary?.totalMoneyIn?.toLocaleString() || 0}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text variant="labelMedium" style={styles.summaryLabel}>
                        Money Out
                      </Text>
                      <Text
                        variant="headlineSmall"
                        style={styles.summaryValueOut}
                      >
                        ₹{allTimeSummary?.totalMoneyOut?.toLocaleString() || 0}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text variant="labelMedium" style={styles.summaryLabel}>
                        Remaining
                      </Text>
                      <Text
                        variant="headlineSmall"
                        style={styles.summaryValueRemaining}
                      >
                        ₹{allTimeSummary?.remaining?.toLocaleString() || 0}
                      </Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text variant="labelMedium" style={styles.summaryLabel}>
                        Entries
                      </Text>
                      <Text
                        variant="headlineSmall"
                        style={styles.summaryGeneric}
                      >
                        {allTimeSummary?.totalExpenses || 0}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>

              {comparison ? (
                <Card style={styles.comparisonCard}>
                  <Card.Title
                    title="Month-over-month change"
                    titleStyle={styles.comparisonTitle}
                  />
                  <Card.Content>
                    {comparisonKeys.map(key => (
                      <View key={key} style={styles.comparisonRow}>
                        <Text
                          variant="bodyLarge"
                          style={styles.comparisonLabel}
                        >
                          {key === 'moneyIn'
                            ? 'Money In'
                            : key === 'moneyOut'
                            ? 'Money Out'
                            : 'Remaining'}
                        </Text>
                        <View style={styles.comparisonValues}>
                          <Text variant="bodyMedium">
                            {comparison[key].difference >= 0 ? '+' : ''}
                            {comparison[key].difference.toLocaleString()}
                          </Text>
                          <Chip
                            compact
                            style={[
                              styles.comparisonChip,
                              comparison[key].difference >= 0
                                ? comparisonChipStyles.positive
                                : comparisonChipStyles.negative,
                            ]}
                          >
                            {comparison[key].percentageChange.toFixed(1)}%
                          </Chip>
                        </View>
                      </View>
                    ))}
                  </Card.Content>
                </Card>
              ) : null}

              <View style={styles.searchContainer}>
                <Search size={20} color="#94A3B8" style={styles.searchIcon} />
                <RNTextInput
                  placeholder="Search by item name, category or notes"
                  placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                  style={styles.searchInput}
                />
              </View>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => {
                  setFilterSheetVisible(true);
                  filterSheetRef.current?.open();
                }}
                activeOpacity={0.7}
              >
                <Filter size={20} color="#94A3B8" />
                <Text style={styles.filterButtonText}>Filters</Text>
                <ChevronDown size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item, index }) => {
            // Skip animation for items beyond the first page (index >= 20) to prevent empty space delay
            const skipAnimation = index >= 20;
            return (
              <AnimatedExpenseCard index={index} skipAnimation={skipAnimation}>
            <Card style={styles.expenseItem}>
              <Card.Title
                    title={item.itemName || item.category}
                    subtitle={
                      item.category
                        ? `${item.category} • ${transformMonthLabel(
                            item.month,
                          )}`
                        : transformMonthLabel(item.month)
                    }
                    titleStyle={styles.expenseTitle}
                    subtitleStyle={styles.expenseSubtitle}
                // eslint-disable-next-line react/no-unstable-nested-components
                right={() => (
                  <View style={styles.expenseAmounts}>
                        {item.amount > 0 ? (
                          <Text style={styles.expenseAmount}>
                            ₹{item.amount.toLocaleString()}
                          </Text>
                        ) : item.moneyOut > 0 ? (
                          <Text style={styles.moneyOut}>
                            -₹{item.moneyOut.toLocaleString()}
                          </Text>
                        ) : item.moneyIn > 0 ? (
                          <Text style={styles.moneyIn}>
                            +₹{item.moneyIn.toLocaleString()}
                          </Text>
                    ) : null}
                        <TouchableOpacity
                          onPress={() => openForm(item)}
                          style={styles.editButton}
                          activeOpacity={0.7}
                        >
                          <Pencil size={18} color="#94A3B8" />
                        </TouchableOpacity>
                  </View>
                )}
              />
              {item.notes ? (
                <Card.Content>
                  <Text variant="bodyMedium" style={styles.expenseNotes}>
                    {item.notes}
                  </Text>
                </Card.Content>
              ) : null}
            </Card>
              </AnimatedExpenseCard>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No expenses yet
              </Text>
              <Text variant="bodyMedium" style={styles.emptySubtitle}>
                Add your first expense or import from a spreadsheet to begin
                tracking.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={openForm}
                activeOpacity={0.8}
              >
                <Plus size={20} color="#F8FAFC" />
                <Text style={styles.emptyButtonText}>Add expense</Text>
              </TouchableOpacity>
            </View>
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      <BottomSheet
        ref={bottomSheetRef}
        title={editingExpenseId ? 'Edit Expense' : 'Add Expense'}
        onClose={handleFormClose}
        footer={
          <View style={styles.formActions}>
            <Button
              mode="outlined"
              onPress={() => {
                bottomSheetRef.current?.close();
              }}
              textColor="#94A3B8"
              style={styles.formButton}
            >
              Cancel
            </Button>
            <PrimaryButton
              title={editingExpenseId ? 'Update' : 'Save'}
              onPress={handleAddExpense}
              loading={savingExpense}
              style={styles.formButton}
              buttonColor="#3A6FF8"
            />
          </View>
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Month</Text>
            <TouchableOpacity
              style={styles.monthPickerButton}
              onPress={() => setMonthPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.monthPickerText,
                  !formValues.month && styles.monthPickerPlaceholder,
                ]}
              >
                {formValues.month
                  ? transformMonthLabel(formValues.month)
                  : 'Select a month'}
              </Text>
              <ChevronDown size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <TextInputField
            label="Item Name"
            value={formValues.itemName}
            onChangeText={value => updateFormValue('itemName', value)}
            placeholder="Enter item name"
          />
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Category (Optional)</Text>
            <TouchableOpacity
              style={styles.monthPickerButton}
              onPress={() => setCategoryPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.monthPickerText,
                  !formValues.category && styles.monthPickerPlaceholder,
                ]}
              >
                {formValues.category || 'Select a category'}
              </Text>
              <ChevronDown size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <TextInputField
                label="Amount"
                value={formValues.amount}
                keyboardType="numeric"
            onChangeText={value => updateFormValue('amount', value)}
            placeholder="0"
          />
          <TextInputField
                label="Notes"
                value={formValues.notes}
            onChangeText={value => updateFormValue('notes', value)}
            placeholder="Optional notes"
                multiline
            numberOfLines={3}
              />
            </ScrollView>
      </BottomSheet>

      {/* FAB Button */}
      <TouchableOpacity
        style={[
          styles.fabButton,
          { bottom: isBottomBarVisible ? 100 : 20 },
        ]}
        onPress={toggleFab}
        activeOpacity={0.8}
      >
        <Plus size={28} color="#F8FAFC" />
      </TouchableOpacity>

      {/* Action Menu Bottom Sheet */}
      <BottomSheet
        ref={fabMenuSheetRef}
        title="Add Expense"
        onClose={() => setFabOpen(false)}
        footer={
          <View style={styles.actionMenuFooter}>
            <Button
              mode="outlined"
              onPress={() => {
                setFabOpen(false);
                fabMenuSheetRef.current?.close();
              }}
              textColor="#94A3B8"
              style={styles.actionMenuButton}
            >
              Cancel
            </Button>
          </View>
        }
      >
        <View style={styles.actionMenuContent}>
          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={handleAddManually}
            activeOpacity={0.7}
          >
            <View style={styles.actionMenuIconContainer}>
              <FileText size={24} color="#3A6FF8" />
            </View>
            <View style={styles.actionMenuTextContainer}>
              <Text style={styles.actionMenuTitle}>Add Manually</Text>
              <Text style={styles.actionMenuSubtitle}>
                Enter expense details manually
              </Text>
            </View>
            <ChevronDown
              size={20}
              color="#94A3B8"
              style={{ transform: [{ rotate: '-90deg' }] }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={handleImportExcel}
            activeOpacity={0.7}
            disabled={uploading}
          >
            <View style={styles.actionMenuIconContainer}>
              <FileSpreadsheet size={24} color="#22C55E" />
            </View>
            <View style={styles.actionMenuTextContainer}>
              <Text style={styles.actionMenuTitle}>Import from Excel</Text>
              <Text style={styles.actionMenuSubtitle}>
                Upload CSV or Excel file
              </Text>
            </View>
            <ChevronDown
              size={20}
              color="#94A3B8"
              style={{ transform: [{ rotate: '-90deg' }] }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={handleSmsFetch}
            activeOpacity={0.7}
          >
            <View style={styles.actionMenuIconContainer}>
              <MessageSquare size={24} color="#F97316" />
            </View>
            <View style={styles.actionMenuTextContainer}>
              <Text style={styles.actionMenuTitle}>SMS Fetch</Text>
              <Text style={styles.actionMenuSubtitle}>
                Extract expenses from SMS
              </Text>
            </View>
            <ChevronDown
              size={20}
              color="#94A3B8"
              style={{ transform: [{ rotate: '-90deg' }] }}
            />
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Month Picker Modal */}
      <Modal
        visible={monthPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <View style={styles.monthPickerModal}>
          <TouchableOpacity
            style={styles.monthPickerBackdrop}
            activeOpacity={1}
            onPress={() => setMonthPickerVisible(false)}
          />
          <View style={styles.monthPickerContainer}>
            <View style={styles.monthPickerHeader}>
              <Text style={styles.monthPickerTitle}>Select Month</Text>
              <TouchableOpacity
                onPress={() => setMonthPickerVisible(false)}
                style={styles.monthPickerCloseButton}
              >
                <Text style={styles.monthPickerCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={monthOptions}
              keyExtractor={item => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.monthPickerItem,
                    formValues.month === item.key &&
                      styles.monthPickerItemSelected,
                  ]}
                  onPress={() => {
                    updateFormValue('month', item.key);
                    setMonthPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.monthPickerItemText,
                      formValues.month === item.key &&
                        styles.monthPickerItemTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {formValues.month === item.key && (
                    <View style={styles.monthPickerCheckmark}>
                      <Text style={styles.monthPickerCheckmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.monthPickerList}
            />
          </View>
        </View>
      </Modal>

      {/* Filter Bottom Sheet */}
      <BottomSheet
        ref={filterSheetRef}
        title="Filters"
        onClose={() => setFilterSheetVisible(false)}
        footer={
          <View style={styles.actionMenuFooter}>
            <Button
              mode="outlined"
              onPress={() => {
                setFilterSheetVisible(false);
                filterSheetRef.current?.close();
              }}
              textColor="#94A3B8"
              style={styles.actionMenuButton}
            >
              Done
            </Button>
          </View>
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.filterSheetScrollContent}
        >
          {/* Month Filter Section */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Month</Text>
            <TouchableOpacity
              style={[
                styles.filterSheetItem,
                selectedMonth === 'All' && styles.filterSheetItemSelected,
              ]}
              onPress={async () => {
                setSelectedMonth('All');
                setPage(1);
                setHasMore(true);
                pageRef.current = 1;
                hasMoreRef.current = true;
                setExpenses([]); // Clear current expenses
                await fetchExpenses('All', 1, false);
                setFilterSheetVisible(false);
                filterSheetRef.current?.close();
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterSheetItemText,
                  selectedMonth === 'All' && styles.filterSheetItemTextSelected,
                ]}
              >
                All Months
              </Text>
              {selectedMonth === 'All' && (
                <View style={styles.filterSheetCheckmark}>
                  <Text style={styles.filterSheetCheckmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
            {months.map(month => (
              <TouchableOpacity
                key={month}
                style={[
                  styles.filterSheetItem,
                  selectedMonth === month && styles.filterSheetItemSelected,
                ]}
                onPress={async () => {
                  setFilterSheetVisible(false);
                  filterSheetRef.current?.close();
                  // Small delay to allow sheet to start closing
                  setTimeout(async () => {
                    setSelectedMonth(month);
                    setPage(1);
                    setHasMore(true);
                    pageRef.current = 1;
                    hasMoreRef.current = true;
                    setExpenses([]); // Clear current expenses
                    await fetchExpenses(month, 1, false);
                  }, 100);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterSheetItemText,
                    selectedMonth === month &&
                      styles.filterSheetItemTextSelected,
                  ]}
                >
                  {transformMonthLabel(month)}
                </Text>
                {selectedMonth === month && (
                  <View style={styles.filterSheetCheckmark}>
                    <Text style={styles.filterSheetCheckmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Category Filter Section */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Category</Text>
            {expenseCategories.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.filterSheetItem,
                  selectedCategory === category &&
                    styles.filterSheetItemSelected,
                ]}
                onPress={() => {
                  setFilterSheetVisible(false);
                  filterSheetRef.current?.close();
                  // Small delay to allow sheet to start closing
                  setTimeout(() => {
                    setSelectedCategory(category);
                  }, 100);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterSheetItemText,
                    selectedCategory === category &&
                      styles.filterSheetItemTextSelected,
                  ]}
                >
                  {category}
                </Text>
                {selectedCategory === category && (
                  <View style={styles.filterSheetCheckmark}>
                    <Text style={styles.filterSheetCheckmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </BottomSheet>

      {/* Category Picker Modal */}
      <Modal
        visible={categoryPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <View style={styles.monthPickerModal}>
          <TouchableOpacity
            style={styles.monthPickerBackdrop}
            activeOpacity={1}
            onPress={() => setCategoryPickerVisible(false)}
          />
          <View style={styles.monthPickerContainer}>
            <View style={styles.monthPickerHeader}>
              <Text style={styles.monthPickerTitle}>Select Category</Text>
              <TouchableOpacity
                onPress={() => setCategoryPickerVisible(false)}
                style={styles.monthPickerCloseButton}
              >
                <Text style={styles.monthPickerCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={categories.all}
              keyExtractor={item => item}
              ListHeaderComponent={
                showAddCategory ? (
                  <View style={styles.addCategoryContainer}>
                    <RNTextInput
                      placeholder="Enter new category name"
                      placeholderTextColor="#94A3B8"
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      style={styles.addCategoryInput}
                      autoFocus
                    />
                    <View style={styles.addCategoryActions}>
                      <TouchableOpacity
                        style={styles.addCategoryCancelButton}
                        onPress={() => {
                          setShowAddCategory(false);
                          setNewCategoryName('');
                        }}
                      >
                        <X size={20} color="#94A3B8" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.addCategorySaveButton,
                          (creatingCategory || !newCategoryName.trim()) &&
                            styles.addCategorySaveButtonDisabled,
                        ]}
                        onPress={() => createCategory(newCategoryName)}
                        disabled={creatingCategory || !newCategoryName.trim()}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.addCategorySaveText}>
                          {creatingCategory ? 'Adding...' : 'Add'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addCategoryButton}
                    onPress={() => setShowAddCategory(true)}
                  >
                    <Plus size={20} color="#3A6FF8" />
                    <Text style={styles.addCategoryButtonText}>
                      Add New Category
                    </Text>
                  </TouchableOpacity>
                )
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.monthPickerItem,
                    formValues.category === item &&
                      styles.monthPickerItemSelected,
                  ]}
                  onPress={() => {
                    updateFormValue('category', item);
                    setCategoryPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.monthPickerItemText,
                      formValues.category === item &&
                        styles.monthPickerItemTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {formValues.category === item && (
                    <View style={styles.monthPickerCheckmark}>
                      <Text style={styles.monthPickerCheckmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.monthPickerList}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  keyboardView: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: themeAssets.spacing[5],
    paddingBottom: themeAssets.spacing[6],
    gap: themeAssets.spacing[3],
    marginBottom: 50,
  },
  listHeader: {
    gap: themeAssets.spacing[3],
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: themeAssets.spacing[3],
  },
  summaryTitle: {
    color: '#F8FAFC',
  },
  summaryAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A6FF8',
    backgroundColor: 'transparent',
  },
  summaryAddButtonText: {
    color: '#3A6FF8',
    fontSize: 14,
    fontFamily: Fonts.semibold,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: themeAssets.spacing[4],
  },
  summaryItem: {
    width: '45%',
  },
  summaryLabel: {
    color: themeAssets.palette.subtext,
    fontFamily: Fonts.regular,
  },
  summaryValueIn: {
    color: themeAssets.palette.success,
    fontFamily: Fonts.semibold,
  },
  summaryValueOut: {
    color: themeAssets.palette.error,
    fontFamily: Fonts.semibold,
  },
  summaryValueRemaining: {
    color: themeAssets.palette.primary,
    fontFamily: Fonts.semibold,
  },
  summaryGeneric: {
    color: themeAssets.palette.text,
    fontFamily: Fonts.regular,
  },
  comparisonCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: themeAssets.spacing[2],
  },
  comparisonLabel: {
    flex: 1,
    color: '#F8FAFC',
  },
  comparisonValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: themeAssets.spacing[2],
  },
  comparisonChip: {
    alignSelf: 'flex-start',
  },
  comparisonTitle: {
    color: '#F8FAFC',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchIcon: {
    marginRight: 0,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
    padding: 0,
    fontFamily: Fonts.regular,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: themeAssets.spacing[2],
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: themeAssets.spacing[2],
  },
  filterChipSelected: {
    backgroundColor: '#3A6FF8',
    borderColor: '#3A6FF8',
  },
  filterIcon: {
    marginRight: 4,
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  filterChipTextSelected: {
    color: '#F8FAFC',
    fontFamily: Fonts.semibold,
  },
  expenseItem: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: themeAssets.spacing[2],
  },
  expenseAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: themeAssets.spacing[3],
  },
  editButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  expenseAmount: {
    color: '#F8FAFC',
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  moneyIn: {
    color: themeAssets.palette.success,
    fontFamily: Fonts.semibold,
    fontSize: 14,
  },
  moneyOut: {
    color: themeAssets.palette.error,
    fontFamily: Fonts.semibold,
    fontSize: 14,
  },
  expenseNotes: {
    color: themeAssets.palette.subtext,
    fontFamily: Fonts.regular
  },
  expenseTitle: {
    color: '#F8FAFC',
    fontFamily: Fonts.semibold,
  },
  expenseSubtitle: {
    color: '#94A3B8',
    fontFamily: Fonts.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: themeAssets.spacing[6],
    gap: themeAssets.spacing[2],
  },
  emptyTitle: {
    fontFamily: Fonts.semibold,
    color: '#F8FAFC',
  },
  emptySubtitle: {
    textAlign: 'center',
    color: '#94A3B8',
    paddingHorizontal: themeAssets.spacing[5],
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: themeAssets.spacing[2],
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#3A6FF8',
    borderWidth: 1,
    borderColor: '#3A6FF8',
  },
  emptyButtonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontFamily: Fonts.semibold,
  },
  input: {
    marginBottom: themeAssets.spacing[3],
  },
  formActions: {
    flexDirection: 'row',
    gap: themeAssets.spacing[2],
    justifyContent: 'flex-end',
  },
  formButton: {
    flex: 1,
    minWidth: 100,
  },
  errorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorTitle: {
    marginBottom: themeAssets.spacing[1],
    color: '#F8FAFC',
  },
  errorText: {
    marginBottom: themeAssets.spacing[1],
    color: '#94A3B8',
  },
  skeletonBase: {
    borderRadius: 12,
    backgroundColor: '#1E293B',
  },
  skeletonContainer: {
    paddingHorizontal: themeAssets.spacing[5],
    paddingTop: themeAssets.spacing[4],
    paddingBottom: themeAssets.spacing[6],
    gap: themeAssets.spacing[3],
  },
  skeletonTitleShort: {
    width: 120,
    height: 18,
  },
  skeletonButton: {
    width: 72,
    height: 32,
    borderRadius: 16,
  },
  skeletonLabel: {
    width: '60%',
    height: 14,
    marginBottom: themeAssets.spacing[1],
  },
  skeletonLabelWide: {
    flex: 1,
    height: 14,
  },
  skeletonValue: {
    width: '80%',
    height: 22,
  },
  skeletonChipValue: {
    width: 64,
    height: 18,
  },
  skeletonChip: {
    width: 54,
    height: 28,
    borderRadius: 14,
  },
  skeletonNotes: {
    marginTop: themeAssets.spacing[2],
    width: '90%',
    height: 16,
  },
  fabButton: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3A6FF8',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  actionMenuContent: {
    paddingVertical: themeAssets.spacing[2],
    gap: themeAssets.spacing[2],
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: themeAssets.spacing[4],
    gap: themeAssets.spacing[3],
    minHeight: 72,
  },
  actionMenuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionMenuTextContainer: {
    flex: 1,
    gap: 4,
  },
  actionMenuTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontFamily: Fonts.semibold,
  },
  actionMenuSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
  },
  actionMenuFooter: {
    paddingTop: themeAssets.spacing[2],
  },
  actionMenuButton: {
    minWidth: 100,
  },
  inputWrapper: {
    marginBottom: themeAssets.spacing[3],
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: Fonts.semibold,
    marginBottom: themeAssets.spacing[1],
  },
  monthPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  monthPickerText: {
    color: '#F8FAFC',
    fontSize: 16,
    flex: 1,
  },
  monthPickerPlaceholder: {
    color: '#94A3B8',
  },
  monthPickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  monthPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  monthPickerContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  monthPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  monthPickerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontFamily: Fonts.semibold,
  },
  monthPickerCloseButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  monthPickerCloseText: {
    color: '#3A6FF8',
    fontSize: 16,
    fontFamily: Fonts.semibold,
  },
  monthPickerList: {
    paddingVertical: 8,
  },
  monthPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  monthPickerItemSelected: {
    backgroundColor: '#0F172A',
  },
  monthPickerItemText: {
    color: '#F8FAFC',
    fontSize: 16,
  },
  monthPickerItemTextSelected: {
    color: '#3A6FF8',
    fontFamily: Fonts.semibold,
  },
  monthPickerCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3A6FF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerCheckmarkText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  addCategoryButtonText: {
    color: '#3A6FF8',
    fontSize: 16,
    fontFamily: Fonts.semibold,
  },
  addCategoryContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 12,
  },
  addCategoryInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 16,
  },
  addCategoryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    alignItems: 'center',
  },
  addCategoryCancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCategorySaveButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#3A6FF8',
  },
  addCategorySaveButtonDisabled: {
    opacity: 0.5,
  },
  addCategorySaveText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: Fonts.semibold,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButtonText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
    fontFamily: Fonts.medium,
  },
  filterSheetContent: {
    paddingVertical: themeAssets.spacing[2],
    gap: themeAssets.spacing[1],
  },
  filterSheetScrollContent: {
    paddingBottom: themeAssets.spacing[4],
  },
  filterSection: {
    marginBottom: themeAssets.spacing[4],
  },
  filterSectionTitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: Fonts.semibold,
    marginBottom: themeAssets.spacing[2],
    paddingHorizontal: themeAssets.spacing[1],
  },
  filterSheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: themeAssets.spacing[2],
  },
  filterSheetItemSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#3A6FF8',
  },
  filterSheetItemText: {
    color: '#F8FAFC',
    fontSize: 16,
  },
  filterSheetItemTextSelected: {
    color: '#3A6FF8',
    fontFamily: Fonts.semibold,
  },
  filterSheetCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3A6FF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterSheetCheckmarkText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  loadMoreContainer: {
    paddingVertical: themeAssets.spacing[4],
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#94A3B8',
    fontSize: 14,
  },
});

export default ExpensesScreen;

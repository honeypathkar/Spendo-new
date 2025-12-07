import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  Platform,
  ToastAndroid,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import GlobalHeader from '../../components/GlobalHeader';
import { useAuth } from '../../hooks/useAuth';
import { apiClient, parseApiError } from '../../api/client';
import { themeAssets } from '../../theme';
import PrimaryButton from '../../components/PrimaryButton';
import BottomSheet from '../../components/BottomSheet';
import TextInputField from '../../components/TextInputField';
import { Plus, Calendar, Trash2 } from 'lucide-react-native';
import Fonts from '../../../assets/fonts';
import { Button } from 'react-native-paper';

const MoneyInScreen = ({ navigation }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [moneyInHistory, setMoneyInHistory] = useState([]);
  const [total, setTotal] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formValues, setFormValues] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const bottomSheetRef = React.useRef(null);

  const fetchMoneyInHistory = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [historyResponse, totalResponse] = await Promise.all([
        apiClient.get('/money-in/history'),
        apiClient.get('/money-in/total'),
      ]);
      setMoneyInHistory(historyResponse.data?.data || []);
      setTotal(totalResponse.data?.data?.total || 0);
    } catch (err) {
      const apiError = parseApiError(err);
      if (Platform.OS === 'android') {
        ToastAndroid.show(apiError.message || 'Failed to fetch money in history', ToastAndroid.LONG);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchMoneyInHistory();
    }, [fetchMoneyInHistory])
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openForm = () => {
    setFormValues({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    bottomSheetRef.current?.open();
  };

  const closeForm = () => {
    bottomSheetRef.current?.close();
  };

  const handleAddMoneyIn = async () => {
    try {
      if (!formValues.amount || Number(formValues.amount) <= 0) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Please enter a valid amount', ToastAndroid.LONG);
        }
        return;
      }

      setSaving(true);
      await apiClient.post('/money-in', {
        amount: Number(formValues.amount),
        date: formValues.date,
        notes: formValues.notes,
      });
      closeForm();
      await fetchMoneyInHistory();
    } catch (err) {
      const apiError = parseApiError(err);
      if (Platform.OS === 'android') {
        ToastAndroid.show(apiError.message || 'Failed to add money in', ToastAndroid.LONG);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    // Delete entry directly with toast confirmation
    try {
      await apiClient.delete(`/money-in/${id}`);
      await fetchMoneyInHistory();
      if (Platform.OS === 'android') {
        ToastAndroid.show('Entry deleted successfully', ToastAndroid.SHORT);
      }
    } catch (err) {
      const apiError = parseApiError(err);
      if (Platform.OS === 'android') {
        ToastAndroid.show(apiError.message || 'Failed to delete entry', ToastAndroid.LONG);
      }
    }
  };

  if (!token) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <GlobalHeader
          title="Money In"
          subtitle="Log in to track your income"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar backgroundColor="#0F172A" barStyle="light-content" />
      <GlobalHeader
        title="Money In History"
        subtitle={`Total: ₹${total.toLocaleString()}`}
        backgroundColor="transparent"
        titleColor="#F8FAFC"
        subtitleColor="#94A3B8"
        showLeftIcon={true}
        leftIconName="ArrowLeft"
        onLeftIconPress={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity
            style={styles.addButton}
            onPress={openForm}
            activeOpacity={0.7}>
            <Plus size={20} color="#3A6FF8" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        }
      />

      {loading && !moneyInHistory.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3A6FF8" />
        </View>
      ) : (
        <FlatList
          data={moneyInHistory}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.historyCard}>
              <Card.Content>
                <View style={styles.historyRow}>
                  <View style={styles.historyInfo}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyAmount}>₹{item.amount.toLocaleString()}</Text>
                      <TouchableOpacity
                        onPress={() => handleDelete(item._id)}
                        style={styles.deleteButton}
                        activeOpacity={0.7}>
                        <Trash2 size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.historyMeta}>
                      <Calendar size={14} color="#94A3B8" />
                      <Text style={styles.historyDate}>
                        {formatDate(item.date)} at {formatTime(item.date)}
                      </Text>
                    </View>
                    {item.notes ? (
                      <Text style={styles.historyNotes}>{item.notes}</Text>
                    ) : null}
                  </View>
                </View>
              </Card.Content>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No money in entries yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the "Add" button to record your first income
              </Text>
            </View>
          }
        />
      )}

      <BottomSheet
        ref={bottomSheetRef}
        title="Add Money In"
        onClose={() => setFormValues({ amount: '', date: new Date().toISOString().split('T')[0], notes: '' })}
        footer={
          <View style={styles.formActions}>
            <Button
              mode="outlined"
              onPress={closeForm}
              textColor="#94A3B8"
              style={styles.formButton}>
              Cancel
            </Button>
            <PrimaryButton
              title="Save"
              onPress={handleAddMoneyIn}
              loading={saving}
              style={styles.formButton}
              buttonColor="#3A6FF8"
            />
          </View>
        }>
        <View style={styles.formContent}>
          <TextInputField
            label="Amount"
            value={formValues.amount}
            keyboardType="numeric"
            onChangeText={(value) => setFormValues({ ...formValues, amount: value })}
            placeholder="0"
          />
          <TextInputField
            label="Date"
            value={formValues.date}
            onChangeText={(value) => setFormValues({ ...formValues, date: value })}
            placeholder="YYYY-MM-DD"
          />
          <TextInputField
            label="Notes (Optional)"
            value={formValues.notes}
            onChangeText={(value) => setFormValues({ ...formValues, notes: value })}
            placeholder="Add a note"
            multiline
            numberOfLines={3}
          />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  listContent: {
    paddingHorizontal: themeAssets.spacing[5],
    paddingTop: themeAssets.spacing[4],
    paddingBottom: themeAssets.spacing[6],
    gap: themeAssets.spacing[2],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
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
  addButtonText: {
    color: '#3A6FF8',
    fontSize: 14,
    fontFamily: Fonts.semibold,
  },
  historyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: themeAssets.spacing[2],
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyInfo: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: themeAssets.spacing[1],
  },
  historyAmount: {
    color: '#22C55E',
    fontSize: 20,
    fontFamily: Fonts.bold,
  },
  deleteButton: {
    padding: 4,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: themeAssets.spacing[1],
  },
  historyDate: {
    color: '#94A3B8',
    fontSize: 14,
  },
  historyNotes: {
    color: '#F8FAFC',
    fontSize: 14,
    marginTop: themeAssets.spacing[1],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: themeAssets.spacing[6],
    gap: themeAssets.spacing[2],
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontFamily: Fonts.semibold,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
  formContent: {
    gap: themeAssets.spacing[3],
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
});

export default MoneyInScreen;


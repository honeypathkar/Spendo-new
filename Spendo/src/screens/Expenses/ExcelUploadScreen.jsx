import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ToastAndroid,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlobalHeader from '../../components/GlobalHeader';
import { useAuth } from '../../hooks/useAuth';
import { apiClient, parseApiError } from '../../api/client';
import { themeAssets } from '../../theme';
import { Upload, FileSpreadsheet, Check, X, Edit2 } from 'lucide-react-native';
import PrimaryButton from '../../components/PrimaryButton';
import Fonts from '../../../assets/fonts';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';
import * as XLSX from 'xlsx';
import RNFS from 'react-native-fs';
import TextInputField from '../../components/TextInputField';

const ExcelUploadScreen = () => {
  const { token } = useAuth();
  const navigation = useNavigation();
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [extractedData, setExtractedData] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedData, setEditedData] = useState(null);

  // Convert month name to YYYY-MM format
  const parseMonth = (monthString) => {
    if (!monthString) return null;
    
    // Check if already in YYYY-MM format
    const yyyyMMRegex = /^\d{4}-\d{2}$/;
    if (yyyyMMRegex.test(monthString.trim())) {
      return monthString.trim();
    }

    // Try to parse month names like "June 2025", "June2025", "Jun 2025"
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
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
  };

  // Format YYYY-MM to "Month YYYY" format for display
  const formatMonthForDisplay = (monthString) => {
    if (!monthString) return '';
    
    // Check if already in readable format (contains month name)
    if (monthString.match(/[a-zA-Z]/)) {
      return monthString;
    }
    
    // Parse YYYY-MM format
    const yyyyMMRegex = /^(\d{4})-(\d{2})$/;
    const match = monthString.match(yyyyMMRegex);
    
    if (match) {
      const year = match[1];
      const monthIndex = parseInt(match[2], 10) - 1;
      
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${monthNames[monthIndex]} ${year}`;
      }
    }
    
    return monthString;
  };

  const handleFilePick = useCallback(async () => {
    try {
      setParsing(true);
      setError(null);
      setExtractedData([]);

      const [pickerResult] = await pick({
        mode: 'open',
        type: [types.xlsx, types.csv, types.plainText],
      });

      if (!pickerResult) {
        setParsing(false);
        return;
      }

      // Use the URI directly from picker result
      // The picker result should have a uri property we can use directly
      const fileUri = pickerResult.uri;
      
      if (!fileUri) {
        throw new Error('Unable to get file URI. Please try selecting the file again.');
      }

      // Read file content directly from URI
      // For React Native, we can read the file using the URI
      let fileContent;
      try {
        // Try reading as base64 directly
        fileContent = await RNFS.readFile(fileUri, 'base64');
      } catch (readError) {
        // If direct read fails, try normalizing the path
        let normalizedPath = fileUri;
        if (normalizedPath.startsWith('file://')) {
          normalizedPath = normalizedPath.replace('file://', '');
        }
        // For Android, ensure we have the correct path format
        if (Platform.OS === 'android' && !normalizedPath.startsWith('/')) {
          normalizedPath = `/${normalizedPath}`;
        }
        fileContent = await RNFS.readFile(normalizedPath, 'base64');
      }

      const workbook = XLSX.read(fileContent, { type: 'base64' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      // Get raw data first to see actual column names
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        defval: '', // Default value for empty cells
        raw: true, // Keep raw values to preserve numbers
      });

      if (!jsonData.length) {
        throw new Error('No data found in the selected file');
      }

      // Debug: Log first row to see actual structure
      console.log('First row keys:', Object.keys(jsonData[0]));
      console.log('First row data:', jsonData[0]);

      // Helper function to get value from row by trying multiple key variations
      const getValue = (row, possibleKeys) => {
        // First try exact match
        for (const key of possibleKeys) {
          if (row.hasOwnProperty(key)) {
            const value = row[key];
            if (value !== null && value !== undefined && value !== '') {
              return value;
            }
          }
        }
        // Try case-insensitive match
        const rowKeys = Object.keys(row);
        for (const key of possibleKeys) {
          const found = rowKeys.find(rk => {
            const rkLower = rk.toLowerCase().trim();
            const keyLower = key.toLowerCase().trim();
            return rkLower === keyLower || rkLower.includes(keyLower) || keyLower.includes(rkLower);
          });
          if (found) {
            const value = row[found];
            if (value !== null && value !== undefined && value !== '') {
              return value;
            }
          }
        }
        return null;
      };

      // Map Excel columns to our format
      const mappedData = jsonData.map((row, index) => {
        // Try different possible column names for month
        const monthValue = getValue(row, [
          'Month', 'month', 'MONTH', 'Month ', 'month ', 
          'Date', 'date', 'DATE'
        ]);
        const month = parseMonth(monthValue || '');
        
        // Try different possible column names for item name
        const itemName = getValue(row, [
          'Name', 'name', 'NAME', 'Name ', 'name ',
          'Item Name', 'item name', 'ItemName', 'itemName',
          'Item', 'item', 'ITEM', 'Description', 'description'
        ]) || '';
        
        // Try different possible column names for category
        const category = getValue(row, [
          'Category', 'category', 'CATEGORY', 'Category ', 'category ',
          'Cat', 'cat', 'CAT'
        ]) || '';
        
        // Try different possible column names for amount - check ALL possible variations
        let amountValue = getValue(row, [
          'Amount (₹)', 'Amount(₹)', 'Amount (Rs)', 'Amount(Rs)',
          'Amount (INR)', 'Amount(INR)', 'Amount', 'amount', 'AMOUNT',
          'Amount ', 'amount ', 'AMOUNT (₹)', 'AMOUNT(₹)',
          'Price', 'price', 'PRICE', 'Cost', 'cost', 'COST',
          'Value', 'value', 'VALUE'
        ]);
        
        // If still not found, try to find any column that might contain amount
        if (!amountValue || amountValue === 0 || amountValue === '') {
          const rowKeys = Object.keys(row);
          const amountKey = rowKeys.find(key => {
            const keyLower = key.toLowerCase();
            return keyLower.includes('amount') || 
                   keyLower.includes('price') || 
                   keyLower.includes('cost') || 
                   keyLower.includes('value') ||
                   keyLower.includes('₹') ||
                   keyLower.includes('rs') ||
                   keyLower.includes('inr');
          });
          if (amountKey) {
            amountValue = row[amountKey];
          }
        }
        
        // Clean and parse the amount value
        let amount = 0;
        if (amountValue !== null && amountValue !== undefined && amountValue !== '') {
          // If it's already a number, use it directly
          if (typeof amountValue === 'number') {
            amount = Math.abs(amountValue);
          } else {
            // Convert to string and clean it
            const amountStr = String(amountValue)
              .replace(/[₹,Rs\s]/gi, '') // Remove currency symbols, commas, and spaces
              .replace(/[^\d.-]/g, '') // Remove all non-numeric except dots and minus
              .trim();
            
            // Parse as number
            const parsed = parseFloat(amountStr);
            amount = isNaN(parsed) ? 0 : Math.abs(parsed);
          }
        }

        // Debug log for first few rows
        if (index < 3) {
          console.log(`Row ${index}:`, {
            originalRow: row,
            itemName,
            category,
            amountValue,
            parsedAmount: amount,
          });
        }

        return {
          id: index,
          month: month || '',
          itemName: itemName || '',
          category: category || '',
          amount: amount,
          notes: getValue(row, ['Notes', 'notes', 'Note', 'note', 'Description', 'description']) || '',
          originalRow: row,
        };
      });

      setExtractedData(mappedData);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        setParsing(false);
        return;
      }
      const errorMessage = err.message || 'Failed to parse file';
      setError(errorMessage);
      if (Platform.OS === 'android') {
        ToastAndroid.show(errorMessage, ToastAndroid.LONG);
      }
    } finally {
      setParsing(false);
    }
  }, []);

  const handleEditRow = (index) => {
    setEditingIndex(index);
    setEditedData({ ...extractedData[index] });
  };

  const handleSaveEdit = () => {
    if (!editedData) return;
    
    const updated = [...extractedData];
    updated[editingIndex] = {
      ...editedData,
      month: parseMonth(editedData.month) || editedData.month,
      amount: Number(editedData.amount) || 0,
    };
    setExtractedData(updated);
    setEditingIndex(null);
    setEditedData(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditedData(null);
  };

  const handleDeleteRow = (index) => {
    const updated = extractedData.filter((_, i) => i !== index);
    setExtractedData(updated);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Row deleted', ToastAndroid.SHORT);
    }
  };

  const handleBulkUpload = async () => {
    // Prevent double click
    if (uploading) {
      return;
    }

    if (!token) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Please log in to upload expenses', ToastAndroid.LONG);
      }
      return;
    }

    if (extractedData.length === 0) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('No data to upload', ToastAndroid.LONG);
      }
      return;
    }

    // Validate all rows have required fields
    const invalidRows = extractedData.filter((row) => {
      const amount = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount) || 0;
      return !row.month || !row.itemName || !amount || amount <= 0;
    });

    if (invalidRows.length > 0) {
      if (Platform.OS === 'android') {
        ToastAndroid.show(
          `Please fix ${invalidRows.length} row(s) with missing or invalid data (Month, Name, and Amount are required)`,
          ToastAndroid.LONG
        );
      }
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Convert to API format
      const expenses = extractedData.map((row) => ({
        month: row.month,
        itemName: row.itemName,
        category: row.category || '',
        amount: Number(row.amount),
        notes: row.notes || '',
        moneyOut: Number(row.amount), // Set moneyOut = amount
        moneyIn: 0,
      }));

      await apiClient.post('/expenses/upload', { expenses });

      // Show ToastAndroid on Android, Alert on iOS
      if (Platform.OS === 'android') {
        ToastAndroid.show(
          `${expenses.length} expenses uploaded successfully!`,
          ToastAndroid.LONG
        );
      } else {
        if (Platform.OS === 'android') {
          ToastAndroid.show(`${expenses.length} expenses uploaded successfully!`, ToastAndroid.LONG);
        }
      }

      // Navigate back after a short delay
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (err) {
      const apiError = parseApiError(err);
      setError(apiError.message);
      if (Platform.OS === 'android') {
        ToastAndroid.show(`Upload Failed: ${apiError.message}`, ToastAndroid.LONG);
      }
    } finally {
      setUploading(false);
    }
  };

  if (!token) {
    return (
      <View style={styles.container}>
        <GlobalHeader
          title="Upload Excel"
          subtitle="Log in to upload expenses"
          showLeftIcon={true}
          onLeftIconPress={() => navigation.goBack()}
          leftIconName="arrow-left"
          leftIconColor="#F8FAFC"
        />
        <View style={styles.centered}>
          <Text variant="titleMedium" style={styles.centeredTitle}>
            You're not logged in!
          </Text>
          <Text variant="bodyMedium" style={styles.centeredSubtitle}>
            Please log in to upload expenses.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <GlobalHeader
        title="Upload Excel"
        subtitle="Upload and review your expenses"
        showLeftIcon={true}
        onLeftIconPress={() => navigation.goBack()}
        leftIconName="arrow-left"
        leftIconColor="#F8FAFC"
      />

      <View style={styles.contentWrapper}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            extractedData.length > 0 && styles.scrollContentWithButtons,
          ]}
          showsVerticalScrollIndicator={false}>
          {!extractedData.length ? (
            <View style={styles.uploadSection}>
              <Card style={styles.uploadCard}>
                <Card.Content style={styles.uploadCardContent}>
                  <FileSpreadsheet size={64} color="#3A6FF8" />
                  <Text variant="titleLarge" style={styles.uploadTitle}>
                    Upload Excel/CSV File
                  </Text>
                  <Text variant="bodyMedium" style={styles.uploadSubtitle}>
                    Expected columns: Month, Name, Category, Amount (₹)
                  </Text>
                  <Text variant="bodySmall" style={styles.uploadNote}>
                    Example: "June 2025", "Clothes", "Shopping", "2100"
                  </Text>
                  <PrimaryButton
                    title={parsing ? 'Parsing...' : 'Select File'}
                    onPress={handleFilePick}
                    loading={parsing}
                    disabled={parsing}
                    leftIcon={<Upload size={20} color="#F8FAFC" />}
                    style={styles.uploadButton}
                    buttonColor="#3A6FF8"
                  />
                </Card.Content>
              </Card>
            </View>
          ) : (
            <View style={styles.dataSection}>
              <Text variant="titleLarge" style={styles.pageTitle}>
                Upload Expense
              </Text>
              
              <View style={styles.dataHeader}>
                <Text variant="bodyMedium" style={styles.dataTitle}>
                  Extracted Data ({extractedData.length} rows)
                </Text>
                <TouchableOpacity
                  onPress={handleFilePick}
                  style={styles.changeFileButton}>
                  <Text style={styles.changeFileText}>Change File</Text>
                </TouchableOpacity>
              </View>

              {error && (
                <Card style={styles.errorCard}>
                  <Card.Content>
                    <Text variant="bodyMedium" style={styles.errorText}>
                      {error}
                    </Text>
                  </Card.Content>
                </Card>
              )}

              <View style={{ minHeight: extractedData.length * 120 }}>
                <FlashList
                  data={extractedData}
                  keyExtractor={(item) => item.id.toString()}
                  estimatedItemSize={120}
                  scrollEnabled={false}
                  renderItem={({ item, index }) => (
                  <Card style={styles.dataRow}>
                    <Card.Content>
                      {editingIndex === index ? (
                        <View style={styles.editForm}>
                          <TextInputField
                            label="Month (e.g., June 2025 or 2025-06)"
                            value={formatMonthForDisplay(editedData?.month || '')}
                            onChangeText={(value) => {
                              // Parse the input back to YYYY-MM format for storage
                              const parsed = parseMonth(value) || value;
                              setEditedData({ ...editedData, month: parsed });
                            }}
                            placeholder="June 2025"
                          />
                          <TextInputField
                            label="Item Name"
                            value={editedData?.itemName || ''}
                            onChangeText={(value) =>
                              setEditedData({ ...editedData, itemName: value })
                            }
                            placeholder="Item name"
                          />
                          <TextInputField
                            label="Category"
                            value={editedData?.category || ''}
                            onChangeText={(value) =>
                              setEditedData({ ...editedData, category: value })
                            }
                            placeholder="Category (optional)"
                          />
                          <TextInputField
                            label="Amount"
                            value={editedData?.amount?.toString() || ''}
                            keyboardType="numeric"
                            onChangeText={(value) =>
                              setEditedData({ ...editedData, amount: value })
                            }
                            placeholder="0"
                          />
                          <TextInputField
                            label="Notes"
                            value={editedData?.notes || ''}
                            onChangeText={(value) =>
                              setEditedData({ ...editedData, notes: value })
                            }
                            placeholder="Notes (optional)"
                            multiline
                            numberOfLines={2}
                          />
                          <View style={styles.editActions}>
                            <Button
                              mode="outlined"
                              onPress={handleCancelEdit}
                              textColor="#94A3B8"
                              style={styles.editButton}>
                              Cancel
                            </Button>
                            <PrimaryButton
                              title="Save"
                              onPress={handleSaveEdit}
                              style={styles.editButton}
                              buttonColor="#22C55E"
                            />
                          </View>
                        </View>
                      ) : (
                        <View style={styles.rowContent}>
                          <View style={styles.rowInfo}>
                            <Text variant="titleSmall" style={styles.rowItemName}>
                              {item.itemName || 'N/A'}
                            </Text>
                            <Text variant="bodySmall" style={styles.rowDetails}>
                              {item.category && `${item.category} • `}
                              {formatMonthForDisplay(item.month)}
                            </Text>
                            {item.notes && (
                              <Text variant="bodySmall" style={styles.rowNotes}>
                                {item.notes}
                              </Text>
                            )}
                            <Text variant="titleMedium" style={styles.rowAmount}>
                              ₹{typeof item.amount === 'number' ? item.amount.toLocaleString('en-IN') : String(item.amount || 0)}
                            </Text>
                          </View>
                          <View style={styles.rowActions}>
                            <TouchableOpacity
                              onPress={() => handleEditRow(index)}
                              style={styles.actionButton}>
                              <Edit2 size={18} color="#3A6FF8" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteRow(index)}
                              style={styles.actionButton}>
                              <X size={18} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </Card.Content>
                  </Card>
                )}
                />
              </View>
            </View>
          )}
        </ScrollView>

        {extractedData.length > 0 && (
          <View style={styles.fixedBottomActions}>
            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              textColor="#94A3B8"
              style={styles.cancelButton}>
              Cancel
            </Button>
            <PrimaryButton
              title={uploading ? 'Uploading...' : 'Upload Expenses'}
              onPress={handleBulkUpload}
              loading={uploading}
              disabled={uploading || extractedData.length === 0}
              leftIcon={<Check size={20} color="#F8FAFC" />}
              style={styles.uploadButton}
              buttonColor="#22C55E"
            />
          </View>
        )}
      </View>
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
  contentWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: themeAssets.spacing[5],
    paddingBottom: themeAssets.spacing[2],
    paddingTop: themeAssets.spacing[3],
  },
  scrollContentWithButtons: {
    paddingBottom: 100, // Space for fixed buttons
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
  uploadSection: {
    marginTop: themeAssets.spacing[4],
  },
  uploadCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  uploadCardContent: {
    alignItems: 'center',
    paddingVertical: themeAssets.spacing[6],
    gap: themeAssets.spacing[3],
  },
  uploadTitle: {
    color: '#F8FAFC',
    fontFamily: Fonts.bold,
    marginTop: themeAssets.spacing[2],
  },
  uploadSubtitle: {
    color: '#94A3B8',
    textAlign: 'center',
  },
  uploadNote: {
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  uploadButton: {
    marginTop: themeAssets.spacing[2],
    minWidth: 200,
  },
  dataSection: {
    marginTop: themeAssets.spacing[2],
    gap: themeAssets.spacing[3],
  },
  pageTitle: {
    color: '#F8FAFC',
    fontFamily: Fonts.bold,
    fontSize: 24,
    marginBottom: themeAssets.spacing[3],
  },
  dataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: themeAssets.spacing[2],
  },
  dataTitle: {
    color: '#94A3B8',
    fontFamily: Fonts.medium,
  },
  changeFileButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  changeFileText: {
    color: '#3A6FF8',
    fontSize: 14,
    fontFamily: Fonts.semibold,
  },
  errorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
  },
  dataRow: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: themeAssets.spacing[2],
  },
  rowContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowInfo: {
    flex: 1,
    gap: 4,
  },
  rowItemName: {
    color: '#F8FAFC',
    fontFamily: Fonts.semibold,
  },
  rowDetails: {
    color: '#94A3B8',
  },
  rowNotes: {
    color: '#64748B',
    fontStyle: 'italic',
  },
  rowAmount: {
    color: '#22C55E',
    fontFamily: Fonts.bold,
    marginTop: 4,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editForm: {
    gap: themeAssets.spacing[3],
  },
  editActions: {
    flexDirection: 'row',
    gap: themeAssets.spacing[2],
    marginTop: themeAssets.spacing[2],
  },
  editButton: {
    flex: 1,
  },
  fixedBottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: themeAssets.spacing[3],
    paddingHorizontal: themeAssets.spacing[5],
    paddingTop: themeAssets.spacing[3],
    paddingBottom: themeAssets.spacing[4],
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  cancelButton: {
    flex: 1,
    minWidth: 120,
  },
  uploadButton: {
    flex: 1,
    minWidth: 120,
  },
});

export default ExcelUploadScreen;


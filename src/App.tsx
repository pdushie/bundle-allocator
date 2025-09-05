import React, { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FileText, Check, X, Download, Phone, Database, AlertCircle, BarChart, History, Calendar, Eye, Trash2 } from "lucide-react";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import ExcelJS from "exceljs";

type PhoneEntry = {
  number: string;
  allocationGB: number;
  isValid: boolean;
  isDuplicate: boolean;
};

type AllocationSummary = {
  [key: string]: number;
};

type HistoryEntry = {
  id: string;
  date: string;
  timestamp: number;
  entries: PhoneEntry[];
  totalGB: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  type: 'bundle-allocator' | 'bundle-categorizer';
};

// History Manager Component
function HistoryManager({ 
  history, 
  setHistory 
}: {
  history: HistoryEntry[];
  setHistory: (history: HistoryEntry[]) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');

  // Get unique dates from history
  const availableDates = Array.from(new Set(history.map(entry => entry.date))).sort((a, b) => b.localeCompare(a));

  // Filter history by selected date
  const filteredHistory = selectedDate 
    ? history.filter(entry => entry.date === selectedDate)
    : history;

  // Calculate daily summaries
  const dailySummaries = availableDates.map(date => {
    const dayEntries = history.filter(entry => entry.date === date);
    const totalEntries = dayEntries.reduce((sum, entry) => sum + entry.entries.length, 0);
    const totalGB = dayEntries.reduce((sum, entry) => sum + entry.totalGB, 0);
    const totalValid = dayEntries.reduce((sum, entry) => sum + entry.validCount, 0);
    const totalInvalid = dayEntries.reduce((sum, entry) => sum + entry.invalidCount, 0);
    const totalDuplicates = dayEntries.reduce((sum, entry) => sum + entry.duplicateCount, 0);
    const sessionsCount = dayEntries.length;

    return {
      date,
      totalEntries,
      totalGB,
      totalValid,
      totalInvalid,
      totalDuplicates,
      sessionsCount
    };
  });

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear all history? This action cannot be undone.")) {
      setHistory([]);
      setSelectedDate("");
    }
  };

  const exportHistoryToExcel = async () => {
    if (history.length === 0) {
      alert("No history data to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      
      // Daily Summary Sheet
      const summarySheet = workbook.addWorksheet("Daily Summary");
      summarySheet.addRow([
        "Date",
        "Sessions",
        "Total Entries",
        "Valid Numbers",
        "Invalid Numbers", 
        "Duplicates",
        "Total Data (GB)"
      ]);

      dailySummaries.forEach(summary => {
        summarySheet.addRow([
          summary.date,
          summary.sessionsCount,
          summary.totalEntries,
          summary.totalValid,
          summary.totalInvalid,
          summary.totalDuplicates,
          summary.totalGB.toFixed(2)
        ]);
      });

      // Detailed History Sheet
      const detailSheet = workbook.addWorksheet("Detailed History");
      detailSheet.addRow([
        "Date",
        "Time",
        "Type",
        "Phone Number",
        "Allocation (GB)",
        "Status"
      ]);

      history.forEach(entry => {
        entry.entries.forEach(phoneEntry => {
          const status = phoneEntry.isDuplicate ? "Duplicate" : 
                        phoneEntry.isValid ? "Valid" : "Invalid";
          detailSheet.addRow([
            entry.date,
            new Date(entry.timestamp).toLocaleTimeString(),
            entry.type,
            phoneEntry.number,
            phoneEntry.allocationGB,
            status
          ]);
        });
      });

      // Auto-adjust column widths
      [summarySheet, detailSheet].forEach(sheet => {
        sheet.columns.forEach(column => {
          let maxLength = 10;
          if (typeof column.eachCell === "function") {
            column.eachCell({ includeEmpty: true }, (cell) => {
              const cellValue = cell.value ? cell.value.toString() : "";
              maxLength = Math.max(maxLength, cellValue.length);
            });
          }
          column.width = maxLength + 2;
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `History_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      alert("✅ History exported successfully!");
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Error exporting history. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                <History className="w-6 h-6 text-blue-600" />
                History & Analytics
              </h2>
              <p className="text-sm text-gray-600">
                Track and analyze your daily data processing activities
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Dates</option>
                {availableDates.map(date => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
              
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('summary')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'summary' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Summary
                </button>
                <button
                  onClick={() => setViewMode('detailed')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'detailed' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Detailed
                </button>
              </div>

              <button
                onClick={exportHistoryToExcel}
                disabled={history.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export
              </button>

              <button
                onClick={clearHistory}
                disabled={history.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 px-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-gray-200 shadow-inner">
            <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <History className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">No History Yet</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Process some data using the Bundle Allocator or Categorizer to start building your history
            </p>
          </div>
        ) : viewMode === 'summary' ? (
          /* Summary View */
          <div className="space-y-8">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Total Days</p>
                    <p className="text-xl font-bold text-gray-900">{availableDates.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Database className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Total Entries</p>
                    <p className="text-xl font-bold text-gray-900">
                      {dailySummaries.reduce((sum, day) => sum + day.totalEntries, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Database className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Total Data</p>
                    <p className="text-xl font-bold text-gray-900">
                      {dailySummaries.reduce((sum, day) => sum + day.totalGB, 0).toFixed(1)}GB
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <BarChart className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-medium">Sessions</p>
                    <p className="text-xl font-bold text-gray-900">{history.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Summary Chart */}
            {dailySummaries.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Daily Data Processing Trends</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailySummaries.slice(-30)}>
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        labelFormatter={(value) => `Date: ${value}`}
                        formatter={(value, name) => [
                          name === 'totalGB' ? `${value} GB` : value,
                          name === 'totalGB' ? 'Total Data' : 'Total Entries'
                        ]}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="totalEntries" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        name="Total Entries"
                        dot={{ r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="totalGB" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        name="Total Data (GB)"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Daily Summary Table */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-lg font-bold text-gray-900">Daily Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Sessions</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Entries</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Valid</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Invalid</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Duplicates</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Total Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(selectedDate 
                      ? dailySummaries.filter(s => s.date === selectedDate)
                      : dailySummaries
                    ).map((summary) => (
                      <tr key={summary.date} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{summary.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{summary.sessionsCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{summary.totalEntries}</td>
                        <td className="px-4 py-3 text-sm text-green-600 font-medium">{summary.totalValid}</td>
                        <td className="px-4 py-3 text-sm text-red-600 font-medium">{summary.totalInvalid}</td>
                        <td className="px-4 py-3 text-sm text-yellow-600 font-medium">{summary.totalDuplicates}</td>
                        <td className="px-4 py-3 text-sm font-bold text-purple-600">{summary.totalGB.toFixed(2)} GB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Detailed View */
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="text-lg font-bold text-gray-900">Detailed History</h3>
              <p className="text-sm text-gray-600 mt-1">
                {filteredHistory.length} sessions {selectedDate && `on ${selectedDate}`}
              </p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {filteredHistory.map((entry) => (
                <div key={entry.id} className="border-b border-gray-100 p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        {entry.type === 'bundle-allocator' ? 
                          <Phone className="w-4 h-4 text-blue-600" /> : 
                          <BarChart className="w-4 h-4 text-blue-600" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {entry.type === 'bundle-allocator' ? 'Bundle Allocator' : 'Bundle Categorizer'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {entry.date} at {new Date(entry.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{entry.totalGB.toFixed(2)} GB</p>
                      <p className="text-xs text-gray-600">{entry.entries.length} entries</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="bg-green-50 p-2 rounded">
                      <span className="text-green-600 font-medium">Valid: {entry.validCount}</span>
                    </div>
                    <div className="bg-red-50 p-2 rounded">
                      <span className="text-red-600 font-medium">Invalid: {entry.invalidCount}</span>
                    </div>
                    <div className="bg-yellow-50 p-2 rounded">
                      <span className="text-yellow-600 font-medium">Duplicates: {entry.duplicateCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Bundle Allocator App Component
function BundleAllocatorApp({ 
  inputText, 
  setInputText, 
  entries, 
  setEntries,
  onAddToHistory 
}: {
  inputText: string;
  setInputText: (text: string) => void;
  entries: PhoneEntry[];
  setEntries: (entries: PhoneEntry[]) => void;
  onAddToHistory: (entries: PhoneEntry[], type: 'bundle-allocator' | 'bundle-categorizer') => void;
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateNumber = (num: string): boolean => /^0\d{9}$/.test(num);

  const processInput = (text: string) => {
    setInputText(text);
    setIsProcessing(true);

    setTimeout(() => {
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "");

      const parsed: PhoneEntry[] = [];
      const phoneNumbers = new Set<string>();
      const duplicates = new Set<string>();

      // First pass: collect all phone numbers and identify duplicates
      lines.forEach((line) => {
        const cleanedLine = line.replace(/\./g, " ").trim();
        const parts = cleanedLine.split(/[\s-]+/);

        if (parts.length >= 2) {
          const phoneRaw = parts[0];
          let allocRaw = parts[1];

          allocRaw = allocRaw.replace(/gb$/i, "").trim();

          const allocGB = parseFloat(allocRaw);

          if (!isNaN(allocGB)) {
            if (phoneNumbers.has(phoneRaw)) {
              duplicates.add(phoneRaw);
            } else {
              phoneNumbers.add(phoneRaw);
            }
          }
        }
      });

      // Second pass: create entries with duplicate flag
      lines.forEach((line) => {
        const cleanedLine = line.replace(/\./g, " ").trim();
        const parts = cleanedLine.split(/[\s-]+/);

        if (parts.length >= 2) {
          const phoneRaw = parts[0];
          let allocRaw = parts[1];

          allocRaw = allocRaw.replace(/gb$/i, "").trim();

          const allocGB = parseFloat(allocRaw);

          if (!isNaN(allocGB)) {
            parsed.push({
              number: phoneRaw,
              allocationGB: allocGB,
              isValid: validateNumber(phoneRaw),
              isDuplicate: duplicates.has(phoneRaw),
            });
          }
        }
      });

      // Alert if duplicates found
      if (duplicates.size > 0) {
        const duplicateList = Array.from(duplicates).join(', ');
        alert(`⚠️ Duplicate phone numbers detected:\n${duplicateList}\n\nDuplicates will be highlighted in the export.`);
      }

      setEntries(parsed);
      setIsProcessing(false);
    }, 300);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          processInput(reader.result);
        }
      };
      reader.readAsText(file);
    });
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    onDrop(files);
  };

  const handleDropZoneClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onDrop(files);
      e.target.value = '';
    }
  };

  const exportToExcel = async () => {
    if (entries.length === 0) {
      alert("No data to export");
      return;
    }

    setIsExporting(true);

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("PhoneData");
      
      worksheet.addRow([
        "Beneficiary Msisdn",
        "Beneficiary Name", 
        "Voice(Minutes)",
        "Data (MB) (1024MB = 1GB)",
        "Sms(Unit)",
      ]);

      entries.forEach(({ number, allocationGB, isValid, isDuplicate }) => {
        const mb = allocationGB * 1024;
        const row = worksheet.addRow([number, "", 0, mb, 0]);
        
        if (!isValid) {
          row.getCell(1).font = { color: { argb: "FFFF0000" }, bold: true };
        }
        
        if (isDuplicate) {
          row.getCell(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF00' }
          };
        }
      });

      worksheet.columns.forEach((column) => {
        let maxLength = 10;
        if (typeof column.eachCell === "function") {
          column.eachCell({ includeEmpty: true }, (cell) => {
            const cellValue = cell.value ? cell.value.toString() : "";
            maxLength = Math.max(maxLength, cellValue.length);
          });
        }
        column.width = maxLength + 2;
      });

      const lastRowNum = worksheet.lastRow?.number || entries.length + 1;
      const totalRowNum = lastRowNum + 5;
      
      worksheet.getCell(`F${totalRowNum}`).value = { formula: `SUM(D2:D${lastRowNum})` };
      worksheet.getCell(`G${totalRowNum}`).value = { formula: `F${totalRowNum}/1024` };
      worksheet.getCell(`F${totalRowNum}`).font = { bold: true };
      worksheet.getCell(`G${totalRowNum}`).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'UploadTemplate.xlsx';
      link.click();
      URL.revokeObjectURL(url);
      
      const validEntries = entries.filter(entry => entry.isValid && !entry.isDuplicate);
      const duplicateCount = entries.filter(entry => entry.isDuplicate).length;
      const invalidCount = entries.filter(entry => !entry.isValid).length;
      const totalMB = entries.reduce((sum, entry) => sum + (entry.allocationGB * 1024), 0);
      const totalGB = totalMB / 1024;
      
      alert(`✅ Excel file exported successfully!\n\nTotal exported: ${entries.length} entries\nValid: ${validEntries.length}\nDuplicates: ${duplicateCount}\nInvalid: ${invalidCount}\n\nTotal Data: ${totalGB.toFixed(2)} GB (${totalMB.toFixed(0)} MB)`);
      
      // Add to history before clearing
      onAddToHistory(entries, 'bundle-allocator');
      
      setInputText("");
      setEntries([]);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Error exporting to Excel. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  const validEntries = entries.filter(entry => entry.isValid && !entry.isDuplicate);
  const invalidEntries = entries.filter(entry => !entry.isValid);
  const duplicateEntries = entries.filter(entry => entry.isDuplicate);
  const totalGB = entries.reduce((sum, entry) => sum + entry.allocationGB, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mb-8 transition-all hover:shadow-2xl">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <span>Input Data</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Paste phone numbers with allocations or drag & drop a file
            </p>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="relative">
              <textarea
                placeholder="Paste phone numbers and data allocations here&#10;0554739033 20GB&#10;0201234567 15GB&#10;0556789012 10GB"
                className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none font-mono text-sm shadow-sm hover:shadow-md"
                rows={6}
                value={inputText}
                onChange={(e) => processInput(e.target.value)}
              />
              {isProcessing && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-xl">
                  <div className="flex items-center gap-2 text-blue-600 font-medium">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </div>
                </div>
              )}
            </div>

            {/* File Drop Zone */}
            <div
              onClick={handleDropZoneClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                isDragActive 
                  ? "border-blue-500 bg-blue-50 scale-[1.02] shadow-lg" 
                  : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              <div className={`w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-full ${
                isDragActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <Upload className="w-6 h-6" />
              </div>
              {isDragActive ? (
                <p className="text-blue-600 font-bold text-lg">Drop your file here!</p>
              ) : (
                <>
                  <p className="text-gray-700 font-medium mb-2">Drag & drop CSV or TXT files</p>
                  <p className="text-sm text-gray-500">or click to browse files</p>
                </>
              )}
            </div>
            
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".txt,.csv"
              className="hidden"
              multiple
            />
          </div>
        </div>

        {/* Stats Cards */}
        {entries.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <Database className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600 font-medium">Total Entries</p>
                  <p className="text-xl font-bold text-gray-900">{entries.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600 font-medium">Valid Numbers</p>
                  <p className="text-xl font-bold text-green-600">{validEntries.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                  <X className="w-5 h-5 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600 font-medium">Invalid Numbers</p>
                  <p className="text-xl font-bold text-red-600">{invalidEntries.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600 font-medium">Number of Duplicates</p>
                  <p className="text-xl font-bold text-yellow-600">{duplicateEntries.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                  <Database className="w-5 h-5 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600 font-medium">Total Data</p>
                  <p className="text-xl font-bold text-purple-600">{totalGB.toFixed(1)}GB</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {entries.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden transition-all hover:shadow-2xl">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                  <Check className="w-6 h-6 text-green-600" />
                  <span>Processed Results</span>
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {validEntries.length} valid, {invalidEntries.length} invalid, {duplicateEntries.length} duplicates
                </p>
              </div>
              
              <button
                onClick={exportToExcel}
                disabled={isExporting}
                className={`flex items-center gap-2 px-6 py-3 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl ${
                  isExporting 
                    ? 'bg-gray-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                }`}
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span className="font-medium">Export to Excel</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              <div className="grid grid-cols-1 divide-y divide-gray-100">
                {entries.map(({ number, allocationGB, isValid, isDuplicate }, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-4 transition-all duration-200 hover:bg-gray-50 ${
                      isDuplicate ? 'bg-yellow-50' : !isValid ? 'bg-red-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {isDuplicate ? (
                        <div className="p-2 bg-yellow-100 rounded-full">
                          <AlertCircle className="w-5 h-5 text-yellow-600" />
                        </div>
                      ) : isValid ? (
                        <div className="p-2 bg-green-100 rounded-full">
                          <Check className="w-5 h-5 text-green-600" />
                        </div>
                      ) : (
                        <div className="p-2 bg-red-100 rounded-full">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        </div>
                      )}
                      <div>
                        <p className={`font-mono font-medium text-base ${
                          isDuplicate ? 'text-yellow-700' : isValid ? 'text-gray-900' : 'text-red-700'
                        }`}>
                          {number}
                        </p>
                        {isDuplicate && (
                          <p className="text-xs text-yellow-600 font-medium mt-1">Duplicate entry</p>
                        )}
                        {!isValid && !isDuplicate && (
                          <p className="text-xs text-red-600 font-medium mt-1">Invalid format</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className={`font-bold text-lg ${
                        isDuplicate ? 'text-yellow-700' : isValid ? 'text-gray-900' : 'text-red-700'
                      }`}>
                        {allocationGB} GB
                      </p>
                      <p className="text-xs text-gray-500 font-medium mt-1">
                        {(allocationGB * 1024).toFixed(0)} MB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {entries.length === 0 && !isProcessing && (
          <div className="text-center py-12 px-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-gray-200 shadow-inner">
            <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <Phone className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Ready to Process Data</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Enter phone numbers above or drag & drop a file to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Bundle Categorizer App Component
function BundleCategorizerApp({ 
  rawData, 
  setRawData, 
  summary, 
  setSummary, 
  chartData, 
  setChartData,
  onAddToHistory 
}: {
  rawData: string;
  setRawData: (data: string) => void;
  summary: Array<{allocation: string, count: number}>;
  setSummary: (summary: Array<{allocation: string, count: number}>) => void;
  chartData: Array<{allocation: string, count: number}>;
  setChartData: (data: Array<{allocation: string, count: number}>) => void;
  onAddToHistory: (entries: PhoneEntry[], type: 'bundle-allocator' | 'bundle-categorizer') => void;
}) {
  const parseData = () => {
    const lines = rawData.split("\n").map(line => line.trim()).filter(line => line.length > 0);
    const allocationSummary: AllocationSummary = {};
    const processedEntries: PhoneEntry[] = [];

    lines.forEach(line => {
      const parts = line.split(/[\s-]+/);
      const phoneNumber = parts[0] || "";
      let allocation = parts[1] || "";
      allocation = allocation.replace(/[^0-9]/g, "");

      let allocationGB = 0;
      let allocKey = "";

      if (allocation) {
        allocKey = allocation + " GB";
        allocationGB = parseInt(allocation) || 0;
      } else {
        allocKey = "Unknown";
        allocationGB = 0;
      }

      allocationSummary[allocKey] = (allocationSummary[allocKey] || 0) + 1;

      // Create phone entry for history
      processedEntries.push({
        number: phoneNumber,
        allocationGB: allocationGB,
        isValid: /^0\d{9}$/.test(phoneNumber),
        isDuplicate: false
      });
    });

    const summaryArray = Object.entries(allocationSummary).map(([key, value]) => ({
      allocation: key,
      count: value as number,
    }));

    const sortedSummaryArray = summaryArray.sort((a, b) => {
      if (a.allocation === "Unknown" && b.allocation === "Unknown") return 0;
      if (a.allocation === "Unknown") return 1;
      if (b.allocation === "Unknown") return -1;
      
      const aValue = parseInt(a.allocation.replace(/[^0-9]/g, "")) || 0;
      const bValue = parseInt(b.allocation.replace(/[^0-9]/g, "")) || 0;

      const aNum = isNaN(aValue) ? 0 : aValue;
      const bNum = isNaN(bValue) ? 0 : bValue;
      
      return aNum - bNum;
    });

    setSummary(sortedSummaryArray);
    setChartData(sortedSummaryArray);
    
    // Add to history
    onAddToHistory(processedEntries, 'bundle-categorizer');
    
    setRawData("");
  };

  const totalEntries = summary.reduce((total, row) => total + row.count, 0);
  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-200 transition-all hover:shadow-2xl">
          <div className="mb-6">
            <label className="block text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Data Input
            </label>
            <textarea
              className="w-full h-48 p-4 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-mono text-sm bg-white hover:shadow-md"
              placeholder="Paste your data here...&#10;Example:&#10;024XXXXXXXX 20GB&#10;059XXXXXXXX 50GB&#10;0249XXXXXXX 10GB"
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 font-medium">
              {rawData.split('\n').filter(line => line.trim().length > 0).length} lines detected
            </div>
            <button
              onClick={parseData}
              disabled={!rawData.trim()}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <BarChart className="w-5 h-5" />
              Process Data
            </button>
          </div>
        </div>

        {/* Results Section */}
        {summary.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Summary Table */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200 transition-all hover:shadow-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-xl font-bold text-gray-800">Summary</h2>
                <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-bold">
                  {totalEntries} total entries
                </div>
              </div>
              
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Data Allocation
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Count
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summary.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                            {row.allocation}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="bg-gray-100 px-3 py-1 rounded-full font-bold">
                            {row.count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mr-3">
                              <div
                                className="h-2.5 rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${(row.count / totalEntries * 100)}%`,
                                  backgroundColor: COLORS[idx % COLORS.length]
                                }}
                              ></div>
                            </div>
                            <span className="text-sm font-bold min-w-0">
                              {((row.count / totalEntries) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart Section */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200 transition-all hover:shadow-2xl">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Visualization</h2>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-gray-200">
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={chartData}>
                    <XAxis 
                      dataKey="allocation" 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#ADD8E6',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'black',
                        fontSize: '16px'
                      }}
                      formatter={(value) => [value, 'Count']}
                      labelFormatter={(label) => `Allocation: ${label}`}
                    />
                    <Legend />
                    <Bar 
                      dataKey="count" 
                      name="Number of Entries"
                      radius={[4, 4, 0, 0]}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {summary.length === 0 && rawData.trim() === "" && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-inner p-12 text-center border border-gray-200">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <BarChart className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">Ready to Analyze Data</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Paste your data in the input field above and click "Process Data" to see allocation summaries and visualizations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main App with Tabs, Persistent State, and History
export default function App() {
  const [activeTab, setActiveTab] = useState("bundle-allocator");
  
  // Bundle Allocator state
  const [allocatorInputText, setAllocatorInputText] = useState("");
  const [allocatorEntries, setAllocatorEntries] = useState<PhoneEntry[]>([]);
  
  // Bundle Categorizer state
  const [categorizerRawData, setCategorizerRawData] = useState("");
  const [categorizerSummary, setCategorizerSummary] = useState<Array<{allocation: string, count: number}>>([]);
  const [categorizerChartData, setCategorizerChartData] = useState<Array<{allocation: string, count: number}>>([]);

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Add to history function
  const addToHistory = (entries: PhoneEntry[], type: 'bundle-allocator' | 'bundle-categorizer') => {
    const now = new Date();
    const newEntry: HistoryEntry = {
      id: `${type}-${now.getTime()}`,
      date: now.toISOString().split('T')[0],
      timestamp: now.getTime(),
      entries: entries,
      totalGB: entries.reduce((sum, entry) => sum + entry.allocationGB, 0),
      validCount: entries.filter(entry => entry.isValid && !entry.isDuplicate).length,
      invalidCount: entries.filter(entry => !entry.isValid).length,
      duplicateCount: entries.filter(entry => entry.isDuplicate).length,
      type: type
    };

    setHistory(prev => [newEntry, ...prev]);
  };

  const tabs = [
    {
      id: "bundle-allocator",
      name: "Bundle Allocator",
      icon: Phone,
      component: BundleAllocatorApp
    },
    {
      id: "bundle-categorizer", 
      name: "Bundle Categorizer",
      icon: BarChart,
      component: BundleCategorizerApp
    },
    {
      id: "history",
      name: "History & Analytics",
      icon: History,
      component: HistoryManager
    }
  ];

  const renderActiveComponent = () => {
    if (activeTab === "bundle-allocator") {
      return (
        <BundleAllocatorApp
          inputText={allocatorInputText}
          setInputText={setAllocatorInputText}
          entries={allocatorEntries}
          setEntries={setAllocatorEntries}
          onAddToHistory={addToHistory}
        />
      );
    } else if (activeTab === "bundle-categorizer") {
      return (
        <BundleCategorizerApp
          rawData={categorizerRawData}
          setRawData={setCategorizerRawData}
          summary={categorizerSummary}
          setSummary={setCategorizerSummary}
          chartData={categorizerChartData}
          setChartData={setCategorizerChartData}
          onAddToHistory={addToHistory}
        />
      );
    } else if (activeTab === "history") {
      return (
        <HistoryManager
          history={history}
          setHistory={setHistory}
        />
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header with Tabs */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Data Processing Suite V1.0</h1>
                <p className="text-sm text-gray-600">Data validation and categorization tool with history tracking</p>
              </div>
            </div>
            
            {/* History Quick Stats */}
            {history.length > 0 && activeTab !== "history" && (
              <div className="flex items-center gap-4 text-sm">
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                  {history.length} sessions
                </div>
                <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                  {history.reduce((sum, entry) => sum + entry.totalGB, 0).toFixed(1)} GB total
                </div>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.name}
                  {tab.id === "history" && history.length > 0 && (
                    <span className="bg-white/20 text-xs px-2 py-1 rounded-full">
                      {history.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {renderActiveComponent()}
      </div>
    </div>
  );
}
import React, { useState, useCallback, useRef } from "react";
import { Upload, FileText, Check, X, Download, Phone, Database, AlertCircle, BarChart } from "lucide-react";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import ExcelJS from "exceljs";
import { SpeedInsights } from "@vercel/speed-insights/react"

type PhoneEntry = {
  number: string;
  allocationGB: number;
  isValid: boolean;
  isDuplicate: boolean;
};

type AllocationSummary = {
  [key: string]: number;
};

// Bundle Allocator App Component
function BundleAllocatorApp({ 
  inputText, 
  setInputText, 
  entries, 
  setEntries 
}: {
  inputText: string;
  setInputText: (text: string) => void;
  entries: PhoneEntry[];
  setEntries: (entries: PhoneEntry[]) => void;
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null); // File input reference

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

  // Handle click on drop zone to trigger file input
  const handleDropZoneClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file selection via input
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onDrop(files);
      // Reset input value to allow selecting same file again
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
      
      // Add headers
      worksheet.addRow([
        "Beneficiary Msisdn",
        "Beneficiary Name", 
        "Voice(Minutes)",
        "Data (MB) (1024MB = 1GB)",
        "Sms(Unit)",
      ]);

      // Add data rows
      entries.forEach(({ number, allocationGB, isValid, isDuplicate }) => {
        const mb = allocationGB * 1024;
        const row = worksheet.addRow([number, "", 0, mb, 0]);
        
        // Style invalid numbers in red
        if (!isValid) {
          row.getCell(1).font = { color: { argb: "FFFF0000" }, bold: true };
        }
        
        // Style duplicates in yellow background
        if (isDuplicate) {
          row.getCell(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF00' }
          };
        }
      });

      // Auto-adjust column widths
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

      // Add totals row 5 rows after last entry
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
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'UploadTemplate.xlsx';
      link.click();
      
      // Cleanup
      URL.revokeObjectURL(url);
      
      // Calculate counts for success message
      const validEntries = entries.filter(entry => entry.isValid && !entry.isDuplicate);
      const duplicateCount = entries.filter(entry => entry.isDuplicate).length;
      const invalidCount = entries.filter(entry => !entry.isValid).length;
      const totalMB = entries.reduce((sum, entry) => sum + (entry.allocationGB * 1024), 0);
      const totalGB = totalMB / 1024;
      
      // Success message
      alert(`✅ Excel file exported successfully!\n\nTotal exported: ${entries.length} entries\nValid: ${validEntries.length}\nDuplicates: ${duplicateCount}\nInvalid: ${invalidCount}\n\nTotal Data: ${totalGB.toFixed(2)} GB (${totalMB.toFixed(0)} MB)`);
      
      // Clear data after successful export
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
              onClick={handleDropZoneClick} // Add click handler
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
  setChartData 
}: {
  rawData: string;
  setRawData: (data: string) => void;
  summary: Array<{allocation: string, count: number}>;
  setSummary: (summary: Array<{allocation: string, count: number}>) => void;
  chartData: Array<{allocation: string, count: number}>;
  setChartData: (data: Array<{allocation: string, count: number}>) => void;
}) {
  const parseData = () => {
    const lines = rawData.split("\n").map(line => line.trim()).filter(line => line.length > 0);

    // Properly typed object
    const allocationSummary: AllocationSummary = {};

    lines.forEach(line => {
      const parts = line.split(/[\s-]+/); // split by spaces, tabs, or hyphens
      let allocation = parts[1] || "";
      allocation = allocation.replace(/[^0-9]/g, "");

      if (allocation) {
        allocation = allocation + " GB";
      } else {
        allocation = "Unknown";
      }

      allocationSummary[allocation] = (allocationSummary[allocation] || 0) + 1;
    });

    const summaryArray = Object.entries(allocationSummary).map(([key, value]) => ({
      allocation: key,
      count: value as number,
    }));

    setSummary(summaryArray);
    setChartData(summaryArray);
    setRawData(""); // Clear the input text after processing
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

// Main App with Tabs and Persistent State
export default function App() {
  const [activeTab, setActiveTab] = useState("bundle-allocator");
  
  // Bundle Allocator state
  const [allocatorInputText, setAllocatorInputText] = useState("");
  const [allocatorEntries, setAllocatorEntries] = useState<PhoneEntry[]>([]);
  
  // Bundle Categorizer state
  const [categorizerRawData, setCategorizerRawData] = useState("");
  const [categorizerSummary, setCategorizerSummary] = useState<Array<{allocation: string, count: number}>>([]);
  const [categorizerChartData, setCategorizerChartData] = useState<Array<{allocation: string, count: number}>>([]);

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
                <p className="text-sm text-gray-600">Data validation and categorization tool</p>
              </div>
            </div>
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

  return <SpeedInsights />
}
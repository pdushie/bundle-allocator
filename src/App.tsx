import React, { useState, useCallback } from "react";
import { Upload, FileText, Check, X, Download, Phone, Database, AlertCircle } from "lucide-react";
import * as ExcelJS from 'exceljs';

type PhoneEntry = {
  number: string;
  allocationGB: number;
  isValid: boolean;
  isDuplicate: boolean;
};

function App() {
  const [entries, setEntries] = useState<PhoneEntry[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
        const parts = cleanedLine.split(/\s+/);

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
        const parts = cleanedLine.split(/\s+/);

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
        alert(`⚠️ Duplicate phone numbers detected:\n${duplicateList}\n\nDuplicates will be highlighted in yellow in the Excel export.`);
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

  const exportToExcel = async () => {
    if (entries.length === 0) {
      alert("No data to export");
      return;
    }

    setIsExporting(true);

    try {
      const workbook = new ExcelJS.Workbook();
      
      // Create main worksheet
      const worksheet = workbook.addWorksheet('Sheet1');
      
      // Add headers
      worksheet.addRow(['Beneficiary Msisdn', 'Beneficiary Name', 'Voice(Minutes)', 'Data (MB) (1024MB = 1GB)', 'Sms(Unit)']);
      

      // Include ALL entries (valid, invalid, and duplicates)
      entries.forEach((entry, index) => {
        const row = worksheet.addRow([
          entry.number,                    // Beneficiary Msisdn
          '',                             // Beneficiary Name (empty as not provided in input)
          0,                             // Voice(Minutes) (set to zero as not provided in input)
          entry.allocationGB * 1024, // Data (MB) - convert GB to MB and round
          0                              // Sms(Unit) (set to zero as not provided in input)
        ]);

        // Apply row styling
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };
        });

        // Highlight invalid entries in red, duplicates in yellow
        if (!entry.isValid) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
            cell.font = { color: { argb: 'FF000000' }, bold: true };
          });
        } else if (entry.isDuplicate) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            cell.font = { color: { argb: 'FF000000' }, bold: true };
          });
        }
      });

      // Set column widths
      worksheet.columns = [
        { key: 'msisdn', width: 15 },      // Beneficiary Msisdn
        { key: 'name', width: 20 },        // Beneficiary Name
        { key: 'voice', width: 15 },       // Voice(Minutes)
        { key: 'data', width: 15 },        // Data (MB)
        { key: 'sms', width: 12 }          // Sms(Unit)
      ];

      // Totals placement: 5 rows after last entry
      const lastRow = worksheet.lastRow?.number || entries.length + 1;
      const totalRowNumber = lastRow + 5;
      worksheet.getCell(`F${totalRowNumber}`).value = {
        formula: `SUM(D2:D${lastRow})`,
      };
      worksheet.getCell(`G${totalRowNumber}`).value = {
        formula: `F${totalRowNumber}/1024`,
      };
      worksheet.getCell(`F${totalRowNumber}`).font = { bold: true };
      worksheet.getCell(`G${totalRowNumber}`).font = { bold: true };

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Create download link
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.href = url;
      link.download = `UploadTemplate.xlsx`;
      link.click();
      
      // Cleanup
      URL.revokeObjectURL(url);
      
      // Calculate counts for success message
      const validEntries = entries.filter(entry => entry.isValid && !entry.isDuplicate);
      const duplicateCount = entries.filter(entry => entry.isDuplicate).length;
      const invalidCount = entries.filter(entry => !entry.isValid).length;
      
      // Success message
      alert(`✅ Excel file exported successfully!\n\nTotal exported: ${entries.length} entries\nValid: ${validEntries.length}\nDuplicates (highlighted in yellow): ${duplicateCount}\nInvalid (highlighted in red): ${invalidCount}`);
      
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            {/* <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
              <Phone className="w-6 h-6 text-white" />
            </div> */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📱 Phone Number Validator/Extractor</h1>
              <p className="text-sm text-gray-600">Validate phone numbers and prepare data exports</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Input Data
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Paste phone numbers with allocations or drag & drop a file
            </p>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="relative">
              <textarea
                placeholder="Paste phone numbers and data allocations here&#10;0554739033 20GB&#10;0201234567 15GB&#10;0556789012 10GB"
                className="w-full p-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none font-mono text-sm"
                rows={6}
                value={inputText}
                onChange={(e) => processInput(e.target.value)}
              />
              {isProcessing && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </div>
                </div>
              )}
            </div>

            {/* File Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragActive 
                  ? "border-blue-500 bg-blue-50 scale-105" 
                  : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              }`}
            >
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
              {isDragActive ? (
                <p className="text-blue-600 font-medium text-lg">Drop your file here!</p>
              ) : (
                <>
                  <p className="text-gray-600 font-medium mb-2">Drag & drop CSV or TXT files</p>
                  <p className="text-sm text-gray-500">or click to browse files</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {entries.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <Database className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600">Total Entries</p>
                  <p className="text-xl font-bold text-gray-900">{entries.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <Check className="w-4 h-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600">Valid Numbers</p>
                  <p className="text-xl font-bold text-green-600">{validEntries.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                  <X className="w-4 h-4 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600">Invalid Numbers</p>
                  <p className="text-xl font-bold text-red-600">{invalidEntries.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600">Duplicates</p>
                  <p className="text-xl font-bold text-yellow-600">{duplicateEntries.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                  <Database className="w-4 h-4 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-600">Total Data</p>
                  <p className="text-xl font-bold text-purple-600 truncate">{totalGB.toFixed(1)}GB</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {entries.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  Processed Results
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {validEntries.length} valid, {invalidEntries.length} invalid, {duplicateEntries.length} duplicates
                </p>
              </div>
              
              <button
                onClick={exportToExcel}
                disabled={isExporting}
                className={`flex items-center gap-2 px-6 py-3 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 ${
                  isExporting 
                    ? 'bg-gray-400 cursor-not-allowed' 
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
                    <Download className="w-4 h-4" />
                    Export to Excel
                  </>
                )}
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {entries.map(({ number, allocationGB, isValid, isDuplicate }, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0 transition-all duration-200 hover:bg-gray-50 ${
                    isDuplicate ? 'bg-yellow-50' : !isValid ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isDuplicate ? (
                      <div className="p-1 bg-yellow-100 rounded-full">
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                      </div>
                    ) : isValid ? (
                      <div className="p-1 bg-green-100 rounded-full">
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="p-1 bg-red-100 rounded-full">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      </div>
                    )}
                    <div>
                      <p className={`font-mono font-medium ${
                        isDuplicate ? 'text-yellow-700' : isValid ? 'text-gray-900' : 'text-red-700'
                      }`}>
                        {number}
                      </p>
                      {isDuplicate && (
                        <p className="text-xs text-yellow-600">Duplicate entry</p>
                      )}
                      {!isValid && !isDuplicate && (
                        <p className="text-xs text-red-600">Invalid format</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`font-semibold ${
                      isDuplicate ? 'text-yellow-700' : isValid ? 'text-gray-900' : 'text-red-700'
                    }`}>
                      {allocationGB} GB
                    </p>
                    <p className="text-xs text-gray-500">
                      {(allocationGB * 1024).toFixed(0)} MB
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {entries.length === 0 && !isProcessing && (
          <div className="text-center py-12">
            <Phone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No data to process</h3>
            <p className="text-gray-600">
              Enter phone numbers above or drag & drop a file to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
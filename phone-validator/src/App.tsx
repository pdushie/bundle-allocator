import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";

type PhoneNumber = { number: string; isValid: boolean };

function App() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);

  const validateNumber = (num: string) => /^0\d{9}$/.test(num);

  const processInput = (text: string) => {
    // Expecting lines of phone number and allocation, e.g. "0248642873 8"
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "");

    const parsed: PhoneNumber[] = [];

    lines.forEach((line) => {
      // Split on whitespace, expect phone + allocation
      const parts = line.split(/\s+/);
      if (parts.length === 2) {
        const [phone, alloc] = parts;
        parsed.push({
          number: phone,
          isValid: validateNumber(phone),
        });
      }
    });

    setNumbers(parsed);
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "text/plain": [".txt"],
    },
  });

  // New function to export to Excel with colored invalid numbers
  const exportToExcel = () => {
    if (numbers.length === 0) {
      alert("No data to export");
      return;
    }

    // Prepare sheet data: Phone, Allocation (hardcoded to 8 for example), Allocation in MB
    // Adapt if you want to parse allocations from the input
    const sheetData = [
      ["Phone Number", "Original Allocation (GB)", "Allocation in MB"],
    ];

    numbers.forEach(({ number, isValid }) => {
      // For demo, allocation is 8 GB for all — change if needed
      const gb = 8;
      const mb = gb * 1024;
      sheetData.push([number, gb.toString(), mb.toString()]);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Highlight invalid phone numbers in red
    numbers.forEach(({ number, isValid }, idx) => {
      if (!isValid) {
        const cell = ws[`A${idx + 2}`]; // +2 to skip header row
        if (cell) {
          cell.s = {
            font: { color: { rgb: "FF0000" }, bold: true },
          };
        }
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PhoneData");

    XLSX.writeFile(wb, "phone_numbers.xlsx");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-6">📱 Phone Number Validator</h1>

      {/* Textarea for paste */}
      <textarea
        placeholder="Paste phone numbers and allocations here, e.g. 0248642873 8"
        className="w-full max-w-lg p-3 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={5}
        onChange={(e) => processInput(e.target.value)}
      />

      {/* Drag & Drop */}
      <div
        {...getRootProps()}
        className={`w-full max-w-lg p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-blue-500 font-medium">Drop your file here...</p>
        ) : (
          <p className="text-gray-500">
            Drag & drop CSV/TXT here, or click to select file
          </p>
        )}
      </div>

      {/* Results */}
      {numbers.length > 0 && (
        <>
          <div className="w-full max-w-lg mt-6">
            <h2 className="text-xl font-semibold mb-2">Results:</h2>
            <ul className="bg-white shadow rounded-lg divide-y">
              {numbers.map((num, idx) => (
                <li
                  key={idx}
                  className={`p-3 ${
                    num.isValid ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {num.number}
                </li>
              ))}
            </ul>
          </div>
          <button
            className="mt-6 px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={exportToExcel}
          >
            Export to Excel
          </button>
        </>
      )}
    </div>
  );
}

export default App;

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

type PhoneEntry = {
  number: string;
  allocationGB: number;
  isValid: boolean;
};

function App() {
  const [entries, setEntries] = useState<PhoneEntry[]>([]);
  const [inputText, setInputText] = useState<string>("");

  const validateNumber = (num: string): boolean => /^0\d{9}$/.test(num);

  const processInput = (text: string) => {
    setInputText(text); // Update textarea content

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "");

    const parsed: PhoneEntry[] = [];

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
          });
        }
      }
    });

    setEntries(parsed);
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

  const exportToExcel = async () => {
    if (entries.length === 0) {
      alert("No data to export");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("PhoneData");

    worksheet.addRow([
      "Beneficiary Msisdn",
      "Beneficiary Name",
      "Voice(Minutes)",
      "Data (MB) (1024MB = 1GB)",
      "Sms(Unit)",
    ]);

    entries.forEach(({ number, allocationGB, isValid }: PhoneEntry) => {
      const mb = allocationGB * 1024;
      const row = worksheet.addRow([number, "", 0, mb, 0]);

      if (!isValid) {
        row.getCell(1).font = { color: { argb: "FFFF0000" }, bold: true };
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

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, "UploadTemplate.xlsx");

    // Clear textarea and entries after export
    setInputText("");
    setEntries([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-6">📱 Phone Number Validator</h1>

      <textarea
        placeholder="Paste phone numbers and allocations here, e.g. 0554739033. 20GB"
        className="w-full max-w-lg p-3 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={5}
        value={inputText} // Controlled textarea
        onChange={(e) => processInput(e.target.value)}
      />

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

      {entries.length > 0 && (
        <>
          <div className="w-full max-w-lg mt-6">
            <h2 className="text-xl font-semibold mb-2">Results:</h2>
            <ul className="bg-white shadow rounded-lg divide-y">
              {entries.map(({ number, allocationGB, isValid }, idx) => (
                <li
                  key={idx}
                  className={`p-3 ${
                    isValid ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {number} — {allocationGB} GB
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

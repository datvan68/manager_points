import * as XLSX from 'xlsx';

export interface ColumnConfig {
  key: string;       // Key in raw row object
  header: string;    // Display header in Excel
  width?: number;    // Custom column width
  type?: 'string' | 'number' | 'date' | 'percent';
}

export const reportExportHelper = {
  // Sanitize sheet name to conform to Excel limits (max 31 chars, no special chars : \ / ? * [ ] )
  sanitizeSheetName(sheetName: string): string {
    if (!sheetName) return 'Sheet1';
    let clean = sheetName.replace(/[:\\/?*\[\]]/g, '');
    return clean.substring(0, 31);
  },

  // Create a new empty workbook
  createWorkbook(): XLSX.WorkBook {
    return XLSX.utils.book_new();
  },

  // Convert raw rows using columnConfig to sheet rows, format types, and append to workbook
  appendJsonSheet(
    workbook: XLSX.WorkBook,
    sheetName: string,
    rows: any[],
    columnConfig: ColumnConfig[]
  ): XLSX.WorkSheet {
    const cleanSheetName = this.sanitizeSheetName(sheetName);

    // Transform raw rows into Excel-friendly formatted rows
    const excelRows = rows.map(row => {
      const formattedRow: Record<string, any> = {};
      columnConfig.forEach(col => {
        let value = row[col.key];

        // Format cell values
        if (value === undefined || value === null) {
          formattedRow[col.header] = '';
        } else if (col.type === 'percent') {
          // Store percent value directly as number (e.g. 0.85)
          formattedRow[col.header] = typeof value === 'number' ? value : parseFloat(value) || 0;
        } else if (col.type === 'number') {
          formattedRow[col.header] = typeof value === 'number' ? value : parseFloat(value) || 0;
        } else {
          formattedRow[col.header] = String(value);
        }
      });
      return formattedRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Apply custom cell formatting in the worksheet
    columnConfig.forEach((col, colIdx) => {
      if (col.type === 'percent') {
        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
          const cellRef = XLSX.utils.encode_cell({ r: rIdx + 1, c: colIdx }); // rIdx + 1 to skip header row
          const cell = worksheet[cellRef];
          if (cell) {
            cell.t = 'n'; // Numeric type
            cell.z = '0.0%'; // Percent cell format
          }
        }
      }
    });

    // Calculate auto-fit columns if not specified
    const colsWidths = columnConfig.map(col => {
      // Find max length of cell values in this column
      const maxLen = rows.reduce((max, r) => {
        const val = r[col.key];
        let valStr = '';
        if (val !== undefined && val !== null) {
          if (col.type === 'percent') {
            valStr = `${(Number(val) * 100).toFixed(1)}%`;
          } else {
            valStr = String(val);
          }
        }
        return Math.max(max, valStr.length);
      }, col.header.length);

      return {
        wch: col.width || Math.min(Math.max(maxLen + 4, 10), 50) // min 10, max 50 chars wide
      };
    });

    worksheet['!cols'] = colsWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, cleanSheetName);
    return worksheet;
  },

  // Write workbook to file
  writeWorkbook(workbook: XLSX.WorkBook, fileName: string) {
    XLSX.writeFile(workbook, fileName);
  }
};

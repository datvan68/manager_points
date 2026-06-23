import * as ExcelJS from 'exceljs';

export async function generatePl03Excel(
  summaries: any[],
  classInfo: any,
  semesterInfo: any,
  departmentInfo: any
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('TT40');

  // --- Page setup ---
  sheet.pageSetup.margins = {
    left: 0.25, right: 0.25,
    top: 0.75, bottom: 0.75,
    header: 0.3, footer: 0.3
  };

  // --- Define columns width ---
  sheet.columns = [
    { width: 5 },   // A - TT
    { width: 20 },  // B - HO VA TEN DEM
    { width: 10 },  // C - TEN
    { width: 15 },  // D - MSSV
    { width: 12 },  // E - DIEM
    { width: 18 },  // F - XEP LOAI
    { width: 15 }   // G - GHI CHU
  ];

  // --- Header section ---
  sheet.mergeCells('G1:G1');
  sheet.getCell('G1').value = 'Phụ lục 03';
  sheet.getCell('G1').font = { name: 'Times New Roman', size: 12, italic: true };
  sheet.getCell('G1').alignment = { horizontal: 'right' };

  sheet.mergeCells('A3:C3');
  sheet.getCell('A3').value = 'TRƯỜNG CAO ĐẲNG BÁCH KHOA';
  sheet.getCell('A3').font = { name: 'Times New Roman', size: 12 };
  sheet.getCell('A3').alignment = { horizontal: 'center' };

  sheet.mergeCells('A4:C4');
  sheet.getCell('A4').value = 'NAM SÀI GÒN';
  sheet.getCell('A4').font = { name: 'Times New Roman', size: 12, bold: true, underline: true };
  sheet.getCell('A4').alignment = { horizontal: 'center' };

  sheet.mergeCells('D3:G3');
  sheet.getCell('D3').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
  sheet.getCell('D3').font = { name: 'Times New Roman', size: 12, bold: true };
  sheet.getCell('D3').alignment = { horizontal: 'center' };

  sheet.mergeCells('D4:G4');
  sheet.getCell('D4').value = 'Độc lập - Tự do - Hạnh phúc';
  sheet.getCell('D4').font = { name: 'Times New Roman', size: 12, bold: true, underline: true };
  sheet.getCell('D4').alignment = { horizontal: 'center' };

  sheet.mergeCells('A5:C5');
  sheet.getCell('A5').value = `KHOA: ${departmentInfo?.name || '...........................................'}`.toUpperCase();
  sheet.getCell('A5').font = { name: 'Times New Roman', size: 12, bold: true };
  sheet.getCell('A5').alignment = { horizontal: 'center' };

  sheet.mergeCells('A7:G7');
  sheet.getCell('A7').value = 'BẢNG TỔNG HỢP KẾT QUẢ RÈN LUYỆN HỌC SINH SINH VIÊN';
  sheet.getCell('A7').font = { name: 'Times New Roman', size: 14, bold: true };
  sheet.getCell('A7').alignment = { horizontal: 'center' };

  sheet.mergeCells('A8:G8');
  sheet.getCell('A8').value = `LỚP: ${classInfo?.class_name || '.............'} HỌC KỲ: ${semesterInfo?.semester_name || '.............'} - NĂM HỌC ${semesterInfo?.year || '.............'}`;
  sheet.getCell('A8').font = { name: 'Times New Roman', size: 12, bold: true };
  sheet.getCell('A8').alignment = { horizontal: 'center' };

  // --- Table Header ---
  const headerRow = sheet.getRow(10);
  headerRow.height = 30;
  
  sheet.mergeCells('B10:C10');

  const headers = [
    { cell: 'A10', value: 'TT' },
    { cell: 'B10', value: 'HỌ VÀ TÊN' },
    { cell: 'D10', value: 'MSSV' },
    { cell: 'E10', value: 'ĐIỂM RÈN LUYỆN (bằng số)' },
    { cell: 'F10', value: 'XẾP LOẠI RÈN LUYỆN' },
    { cell: 'G10', value: 'GHI CHÚ' }
  ];

  headers.forEach(h => {
    const cell = sheet.getCell(h.cell);
    cell.value = h.value;
    cell.font = { name: 'Times New Roman', size: 11, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  
  sheet.getCell('C10').border = { top: { style: 'thin' }, bottom: { style: 'thin' } }; // Fix merge border

  // --- Data Rows ---
  let currentRow = 11;
  const totalStudents = summaries.length;
  // Ensure at least 35 rows for layout
  const rowsCount = Math.max(totalStudents, 35);
  
  const stats = {
    XS: 0,
    TOT: 0,
    KHA: 0,
    TB: 0,
    YEU: 0
  };

  for (let i = 0; i < rowsCount; i++) {
    const summary = summaries[i];
    const row = sheet.getRow(currentRow);
    row.height = 20;

    let tt = '';
    let hoTenDem = '';
    let ten = '';
    let mssv = '';
    let diem: number | string = '';
    let xepLoai = '';
    let ghiChu = '';

    if (summary) {
      tt = (i + 1).toString();
      
      const fullName = summary.student_id?.full_name || '';
      const parts = fullName.trim().split(' ');
      if (parts.length > 1) {
        ten = parts.pop() || '';
        hoTenDem = parts.join(' ');
      } else {
        ten = fullName;
      }

      mssv = summary.student_id?.student_code || '';
      diem = summary.total_score ?? 0;
      
      // Calculate grade
      const score = Number(diem);
      if (score >= 90) { xepLoai = 'XUẤT SẮC'; stats.XS++; }
      else if (score >= 80) { xepLoai = 'TỐT'; stats.TOT++; }
      else if (score >= 70) { xepLoai = 'KHÁ'; stats.KHA++; }
      else if (score >= 50) { xepLoai = 'TRUNG BÌNH'; stats.TB++; }
      else { xepLoai = 'YẾU'; stats.YEU++; }

      if (summary.status !== 'locked') {
        ghiChu = 'Chưa phê duyệt';
      }
    }

    row.getCell(1).value = tt;
    row.getCell(2).value = hoTenDem;
    row.getCell(3).value = ten;
    row.getCell(4).value = mssv;
    row.getCell(5).value = diem;
    row.getCell(6).value = xepLoai;
    row.getCell(7).value = ghiChu;

    for (let col = 1; col <= 7; col++) {
      const cell = row.getCell(col);
      cell.font = { name: 'Times New Roman', size: 11 };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { vertical: 'middle' };
      if (col === 1 || col === 5 || col === 6) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (col === 4) {
         cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (col === 2) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' }
          };
      }
      if (col === 3) {
          cell.border = {
            top: { style: 'thin' },
            right: { style: 'thin' },
            bottom: { style: 'thin' }
          };
      }
    }

    currentRow++;
  }

  // --- Statistics Section ---
  const startStatRow = currentRow;
  
  // Header Stat
  sheet.mergeCells(`A${startStatRow}:G${startStatRow}`);
  const statHeaderCell = sheet.getCell(`A${startStatRow}`);
  statHeaderCell.value = 'Tổng hợp kết quả rèn luyện';
  statHeaderCell.font = { name: 'Times New Roman', size: 11, bold: true, italic: true };
  statHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };
  statHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' }
  };
  
  // Xep Loai Row
  const xepLoaiRow = startStatRow + 1;
  sheet.getCell(`A${xepLoaiRow}`).value = 'Xếp loại';
  sheet.getCell(`B${xepLoaiRow}`).value = 'XS';
  sheet.getCell(`C${xepLoaiRow}`).value = 'TỐT';
  sheet.getCell(`D${xepLoaiRow}`).value = 'KHÁ';
  sheet.getCell(`E${xepLoaiRow}`).value = 'TB';
  sheet.getCell(`F${xepLoaiRow}`).value = 'YẾU';
  sheet.getCell(`G${xepLoaiRow}`).value = 'TỔNG SỐ';

  // So luong Row
  const slRow = startStatRow + 2;
  sheet.getCell(`A${slRow}`).value = 'Số lượng';
  sheet.getCell(`B${slRow}`).value = stats.XS;
  sheet.getCell(`C${slRow}`).value = stats.TOT;
  sheet.getCell(`D${slRow}`).value = stats.KHA;
  sheet.getCell(`E${slRow}`).value = stats.TB;
  sheet.getCell(`F${slRow}`).value = stats.YEU;
  sheet.getCell(`G${slRow}`).value = totalStudents;

  // Ti le Row
  const percentRow = startStatRow + 3;
  sheet.getCell(`A${percentRow}`).value = 'Tỉ lệ %';
  const getPercent = (count: number) => totalStudents > 0 ? (count / totalStudents) : 0;
  
  sheet.getCell(`B${percentRow}`).value = getPercent(stats.XS);
  sheet.getCell(`C${percentRow}`).value = getPercent(stats.TOT);
  sheet.getCell(`D${percentRow}`).value = getPercent(stats.KHA);
  sheet.getCell(`E${percentRow}`).value = getPercent(stats.TB);
  sheet.getCell(`F${percentRow}`).value = getPercent(stats.YEU);
  sheet.getCell(`G${percentRow}`).value = totalStudents > 0 ? 1 : 0;
  
  // Format stats block
  for (let r = startStatRow; r <= percentRow; r++) {
    const row = sheet.getRow(r);
    row.height = 20;
    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      if (r > startStatRow) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.font = { name: 'Times New Roman', size: 11, bold: r === xepLoaiRow };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      
      if (r === percentRow && c > 1) {
          cell.numFmt = '0.00%';
      }
    }
  }

  // --- Signatures ---
  const signRow1 = percentRow + 3;
  const signRow2 = signRow1 + 1;

  sheet.mergeCells(`A${signRow1}:D${signRow1}`);
  const gvcnCell = sheet.getCell(`A${signRow1}`);
  gvcnCell.value = 'GVCN/CVHT';
  gvcnCell.font = { name: 'Times New Roman', size: 12, bold: true };
  gvcnCell.alignment = { horizontal: 'center' };

  sheet.mergeCells(`E${signRow1}:G${signRow1}`);
  const truongKhoaCell = sheet.getCell(`E${signRow1}`);
  truongKhoaCell.value = 'TRƯỞNG KHOA';
  truongKhoaCell.font = { name: 'Times New Roman', size: 12, bold: true };
  truongKhoaCell.alignment = { horizontal: 'center' };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}

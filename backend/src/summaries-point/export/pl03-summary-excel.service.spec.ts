import { generatePl03Excel } from './pl03-summary-excel.service';
import * as ExcelJS from 'exceljs';

describe('pl03-summary-excel.service', () => {
  const classInfo = { class_name: 'DHKTPM16A' };
  const semesterInfo = { semester_name: 'HK1', year: '2023-2024' };
  const departmentInfo = { name: 'KHOA CNTT' };

  it('should generate empty excel file with minimum 35 rows and correct layout', async () => {
    const buffer = await generatePl03Excel([], classInfo, semesterInfo, departmentInfo);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('TT40');

    expect(sheet).toBeDefined();
    
    // Check headers
    expect(sheet.getCell('A3').value).toBe('TRƯỜNG CAO ĐẲNG BÁCH KHOA');
    expect(sheet.getCell('A5').value).toContain('KHOA CNTT');
    expect(sheet.getCell('A8').value).toContain('DHKTPM16A');
    expect(sheet.getCell('A8').value).toContain('HK1');
    expect(sheet.getCell('A8').value).toContain('2023-2024');

    // Check minimum rows (header at 10, min 35 rows means stats start at 11 + 35 = 46)
    const statHeaderCell = sheet.getCell('A46');
    expect(statHeaderCell.value).toBe('Tổng hợp kết quả rèn luyện');

    // Check empty stats
    expect(sheet.getCell('G48').value).toBe(0); // TỔNG SỐ
  });

  it('should map data and calculate stats correctly for exactly 2 students', async () => {
    const mockSummaries = [
      {
        student_id: { full_name: 'Nguyen Van A', student_code: 'SV001' },
        total_score: 95, // XUẤT SẮC
        status: 'locked'
      },
      {
        student_id: { full_name: 'Le Thi B', student_code: 'SV002' },
        total_score: 65, // TRUNG BÌNH
        status: 'draft' // Chua phe duyet
      }
    ];

    const buffer = await generatePl03Excel(mockSummaries, classInfo, semesterInfo, departmentInfo);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('TT40');

    // Check first student
    expect(sheet.getCell('B11').value).toBe('Nguyen Van'); // ho ten dem
    expect(sheet.getCell('C11').value).toBe('A'); // ten
    expect(sheet.getCell('D11').value).toBe('SV001');
    expect(sheet.getCell('E11').value).toBe(95);
    expect(sheet.getCell('F11').value).toBe('XUẤT SẮC');
    expect(sheet.getCell('G11').value).toBe(''); // locked so no note

    // Check second student
    expect(sheet.getCell('B12').value).toBe('Le Thi');
    expect(sheet.getCell('C12').value).toBe('B');
    expect(sheet.getCell('D12').value).toBe('SV002');
    expect(sheet.getCell('E12').value).toBe(65);
    expect(sheet.getCell('F12').value).toBe('TRUNG BÌNH');
    expect(sheet.getCell('G12').value).toBe('Chưa phê duyệt');

    // Check stats. Row 46 is still stat header because min rows is 35
    expect(sheet.getCell('A46').value).toBe('Tổng hợp kết quả rèn luyện');
    
    // xepLoaiRow = 47, slRow = 48, percentRow = 49
    expect(sheet.getCell('A48').value).toBe('Số lượng');
    expect(sheet.getCell('B48').value).toBe(1); // XS
    expect(sheet.getCell('C48').value).toBe(0); // TỐT
    expect(sheet.getCell('D48').value).toBe(0); // KHÁ
    expect(sheet.getCell('E48').value).toBe(1); // TB
    expect(sheet.getCell('F48').value).toBe(0); // YẾU
    expect(sheet.getCell('G48').value).toBe(2); // TOTAL

    expect(sheet.getCell('B49').value).toBe(0.5); // 50%
    expect(sheet.getCell('E49').value).toBe(0.5); // 50%
  });

  it('should support dynamic rows > 35', async () => {
    // Generate 40 students
    const mockSummaries = Array.from({ length: 40 }).map((_, i) => ({
      student_id: { full_name: `Student ${i}`, student_code: `SV${i}` },
      total_score: 85, // TỐT
      status: 'locked'
    }));

    const buffer = await generatePl03Excel(mockSummaries, classInfo, semesterInfo, departmentInfo);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('TT40');

    // 40 rows means stats start at 11 + 40 = 51
    expect(sheet.getCell('A51').value).toBe('Tổng hợp kết quả rèn luyện');
    
    // slRow = 53
    expect(sheet.getCell('C53').value).toBe(40); // 40 TOT
    expect(sheet.getCell('G53').value).toBe(40); // Total 40
  });

  it('should map all grade tiers correctly', async () => {
    const scores = [90, 89, 80, 79, 70, 69, 50, 49];
    const expectedGrades = [
      'XUẤT SẮC', 'TỐT', 'TỐT', 'KHÁ', 'KHÁ', 'TRUNG BÌNH', 'TRUNG BÌNH', 'YẾU'
    ];

    const mockSummaries = scores.map((score, i) => ({
      student_id: { full_name: `Student ${i}`, student_code: `SV${i}` },
      total_score: score,
      status: 'locked'
    }));

    const buffer = await generatePl03Excel(mockSummaries, classInfo, semesterInfo, departmentInfo);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('TT40');

    scores.forEach((_, i) => {
      expect(sheet.getCell(`F${11 + i}`).value).toBe(expectedGrades[i]);
    });
  });
});

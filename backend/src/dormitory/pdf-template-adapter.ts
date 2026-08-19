import { createHash } from 'crypto';
import { PdfTemplateFormatter, PdfTemplateLayout, PdfTemplateStyle, PdfTemplateTypeDescriptor } from '../pdf-template/types';

export const DORMITORY_ROSTER_APPLICATION = 'DORMITORY_ROSTER_APPLICATION' as const;
export const DORMITORY_RESIDENCE_INFO = 'DORMITORY_RESIDENCE_INFO' as const;
export const DORMITORY_RESIDENCE_CONTRACT = 'DORMITORY_RESIDENCE_CONTRACT' as const;

const style: PdfTemplateStyle = { fontFamily: 'Times-Roman', fontSize: 11, minFontSize: 7, fontWeight: 400, color: '#000000', horizontalAlign: 'left', verticalAlign: 'middle', lineHeight: 1.15, padding: 0.5, background: 'transparent', overflow: 'shrink', maxLines: 1 };
const fields = [
  ['student.fullName', 'Họ và tên', 'string'], ['student.dateOfBirth', 'Ngày sinh', 'date'], ['student.gender', 'Giới tính', 'string'], ['student.className', 'Lớp', 'string'], ['student.faculty', 'Khoa', 'string'], ['applicant.ethnicity', 'Dân tộc', 'string'], ['applicant.religion', 'Tôn giáo', 'string'], ['roster.phone', 'Điện thoại', 'string'], ['applicant.citizenId', 'Số căn cước', 'string'], ['applicant.citizenIssueDate', 'Ngày cấp căn cước', 'date'], ['applicant.citizenIssuePlace', 'Nơi cấp căn cước', 'string'], ['applicant.permanentAddress', 'Địa chỉ thường trú', 'string'], ['parent.father.name', 'Họ tên cha', 'string'], ['parent.father.age', 'Tuổi cha', 'number'], ['parent.father.address', 'Địa chỉ cha', 'string'], ['parent.father.contactAddress', 'Nơi ở hiện tại của cha', 'string'], ['parent.father.occupation', 'Nghề nghiệp cha', 'string'], ['parent.father.phone', 'Điện thoại cha', 'string'], ['parent.mother.name', 'Họ tên mẹ', 'string'], ['parent.mother.age', 'Tuổi mẹ', 'number'], ['parent.mother.address', 'Địa chỉ mẹ', 'string'], ['parent.mother.contactAddress', 'Nơi ở hiện tại của mẹ', 'string'], ['parent.mother.occupation', 'Nghề nghiệp mẹ', 'string'], ['parent.mother.phone', 'Điện thoại mẹ', 'string'], ['applicant.priority', 'Diện chính sách', 'string'],
] as const;
const bounds = [[296, 191, 240, 18], [323.5, 215, 77, 18], [459, 215, 77, 18], [218, 239, 142, 18], [396.8, 239, 139, 18], [241, 263, 56, 18], [354.5, 263, 49, 18], [466.4, 263, 69.6, 18], [235.2, 287, 70, 18], [362.5, 287, 63, 18], [480.7, 287, 55, 18], [203, 311, 332, 18], [152.4, 335, 239.6, 18], [396.8, 335, 139.2, 18], [203, 359, 332, 18], [194.9, 383, 341.1, 18], [194.9, 407, 114.9, 18], [375.9, 407, 160.1, 18], [152.4, 431, 196, 18], [386.4, 431, 149.6, 18], [203, 455, 332, 18], [194.9, 479, 341.1, 18], [194.9, 503, 114.9, 18], [375.9, 503, 160.1, 18], [302.8, 527, 233.3, 18]] as const;
const key = (index: number) => fields[index][0];
const vietnameseSamples: Record<string, string> = {
  'student.fullName': 'Nguyễn Thị Minh Khánh', 'student.dateOfBirth': '02/01/2004', 'student.gender': 'Nữ', 'student.className': 'CNTT01', 'student.faculty': 'Công nghệ thông tin',
  'applicant.ethnicity': 'Kinh', 'applicant.religion': 'Không', 'roster.phone': '0912345678', 'applicant.citizenId': '012345678901', 'applicant.citizenIssueDate': '01/02/2022', 'applicant.citizenIssuePlace': 'Hà Nội', 'applicant.permanentAddress': 'Hà Nội',
  'parent.father.name': 'Nguyễn Văn Minh', 'parent.father.age': '45', 'parent.father.address': 'Hà Nội', 'parent.father.contactAddress': 'Hà Nội', 'parent.father.occupation': 'Kỹ sư', 'parent.father.phone': '0901234567',
  'parent.mother.name': 'Trần Thị Lan', 'parent.mother.age': '43', 'parent.mother.address': 'Hà Nội', 'parent.mother.contactAddress': 'Hà Nội', 'parent.mother.occupation': 'Giáo viên', 'parent.mother.phone': '0907654321', 'applicant.priority': 'Không'
};
function syntheticValue(name: 'short' | 'long' | 'missing' | 'vietnamese', fieldKey: string, dataType: string, index: number) {
  if (name === 'missing' && index % 3 === 0) return '';
  if (dataType === 'date') return name === 'long' ? '2024-12-31' : '2004-01-02';
  if (name === 'long') return `${fieldKey} - Giá trị rất dài để kiểm tra wrap và shrink trong biểu mẫu ký túc xá`;
  if (name === 'vietnamese') return vietnameseSamples[fieldKey] || 'Giá trị mẫu';
  return `Mẫu ${index + 1}`;
}
export const DORMITORY_ROSTER_APPLICATION_DESCRIPTOR: PdfTemplateTypeDescriptor = {
  moduleCode: 'DORMITORY', featureCode: 'DORMITORY_ROSTER', templateTypeCode: DORMITORY_ROSTER_APPLICATION, displayName: 'Mẫu đơn đăng ký KTX', sourcePermission: 'DORM_REG_READ',
  fields: fields.map(([fieldKey, label, dataType]) => ({ key: fieldKey, label, dataType: dataType as any, sensitive: fieldKey.includes('fullName') || fieldKey.includes('citizen') || fieldKey.includes('phone'), syntheticSample: fieldKey.toLowerCase().includes('date') ? '02/01/2004' : 'Giá trị mẫu', allowedFormatters: (fieldKey.toLowerCase().includes('date') ? ['date_ddmmyyyy'] : ['plain', ...(fieldKey.endsWith('gender') ? ['gender_vi'] : [])]) as PdfTemplateFormatter[], defaultStyle: { ...style, overflow: 'shrink', maxLines: 1 } })),
  pagePolicy: { minPages: 1, maxPages: 10, allowedDimensions: { width: 595.32, height: 842.04, tolerance: 2 } },
  syntheticFixture: (name) => ({ name, values: Object.fromEntries(fields.map(([fieldKey, , dataType], index) => [fieldKey, syntheticValue(name, fieldKey, dataType, index)])) }),
  resolveValues: (context: any) => resolveDormitoryRosterPdfValues(context?.roster, context?.student),
};

const residenceInfoFields = [
  ['student.code', 'Mã sinh viên', 'string'],
  ['student.fullName', 'Họ và tên', 'string'],
  ['student.dateOfBirth', 'Ngày sinh', 'date'],
  ['student.gender', 'Giới tính', 'string'],
  ['student.className', 'Lớp', 'string'],
  ['student.faculty', 'Khoa', 'string'],
  ['roster.phone', 'Số điện thoại', 'string'],
  ['applicant.citizenId', 'Số căn cước', 'string'],
  ['applicant.citizenIssueDate', 'Ngày cấp căn cước', 'date'],
  ['applicant.citizenIssuePlace', 'Nơi cấp căn cước', 'string'],
  ['applicant.permanentAddress', 'Địa chỉ thường trú', 'string'],
  ['applicant.ethnicity', 'Dân tộc', 'string'],
  ['applicant.religion', 'Tôn giáo', 'string'],
  ['dormitory.semester', 'Học kỳ', 'string'],
  ['dormitory.academicYear', 'Năm học', 'string'],
  ['room.code', 'Mã phòng', 'string'],
  ['room.name', 'Tên phòng', 'string'],
  ['bed.code', 'Mã giường', 'string'],
  ['bed.position', 'Vị trí giường', 'string'],
] as const;

const residenceInfoVietnameseSamples: Record<string, string> = {
  'student.code': 'SV2026001',
  'student.fullName': 'Nguyễn Thị Minh Khánh',
  'student.dateOfBirth': '02/01/2004',
  'student.gender': 'Nữ',
  'student.className': 'CNTT01',
  'student.faculty': 'Công nghệ thông tin',
  'roster.phone': '0912345678',
  'applicant.citizenId': '012345678901',
  'applicant.citizenIssueDate': '01/02/2022',
  'applicant.citizenIssuePlace': 'Hà Nội',
  'applicant.permanentAddress': 'Hà Nội',
  'applicant.ethnicity': 'Kinh',
  'applicant.religion': 'Không',
  'dormitory.semester': 'Học kỳ 1',
  'dormitory.academicYear': '2026-2027',
  'room.code': 'P101',
  'room.name': 'Phòng 101',
  'bed.code': 'G01',
  'bed.position': 'Tầng 1 - Trái',
};

function residenceInfoSyntheticValue(name: 'short' | 'long' | 'missing' | 'vietnamese', fieldKey: string, dataType: string, index: number) {
  if (name === 'missing' && index % 3 === 0) return '';
  if (dataType === 'date') return name === 'long' ? '2024-12-31' : '2004-01-02';
  if (name === 'long') return `${fieldKey} - Giá trị rất dài để kiểm tra wrap và shrink trong biểu mẫu thông tin cư trú`;
  if (name === 'vietnamese') return residenceInfoVietnameseSamples[fieldKey] || 'Giá trị mẫu';
  return `Mẫu TT ${index + 1}`;
}

export const DORMITORY_RESIDENCE_INFO_DESCRIPTOR: PdfTemplateTypeDescriptor = {
  moduleCode: 'DORMITORY',
  featureCode: 'DORMITORY_ROSTER',
  templateTypeCode: DORMITORY_RESIDENCE_INFO,
  displayName: 'Mẫu đơn thông tin cư trú',
  sourcePermission: 'DORM_REG_READ',
  fields: residenceInfoFields.map(([fieldKey, label, dataType]) => ({
    key: fieldKey,
    label,
    dataType: dataType as any,
    sensitive: fieldKey === 'student.fullName' || fieldKey === 'roster.phone' || fieldKey === 'applicant.citizenId' || fieldKey === 'applicant.permanentAddress',
    syntheticSample: fieldKey.toLowerCase().includes('date') ? '02/01/2004' : 'Giá trị mẫu',
    allowedFormatters: (fieldKey.toLowerCase().includes('date') ? ['date_ddmmyyyy'] : ['plain', ...(fieldKey.endsWith('gender') ? ['gender_vi'] : [])]) as PdfTemplateFormatter[],
    defaultStyle: { ...style, overflow: 'shrink', maxLines: 1 },
  })),
  pagePolicy: { minPages: 1, maxPages: 10, allowedDimensions: { width: 595.32, height: 842.04, tolerance: 2 } },
  syntheticFixture: (name) => ({
    name,
    values: Object.fromEntries(residenceInfoFields.map(([fieldKey, , dataType], index) => [fieldKey, residenceInfoSyntheticValue(name, fieldKey, dataType, index)])),
  }),
  resolveValues: (context: any) => resolveDormitoryResidenceInfoPdfValues(context?.roster || context, context?.student, context?.room, context?.bed),
};

const contractFields = [
  ['contract.code', 'Số hợp đồng', 'string'],
  ['contract.startDate', 'Ngày bắt đầu', 'date'],
  ['contract.endDate', 'Ngày kết thúc', 'date'],
  ['contract.status', 'Trạng thái', 'string'],
  ['student.code', 'Mã sinh viên', 'string'],
  ['student.fullName', 'Họ và tên', 'string'],
  ['student.dateOfBirth', 'Ngày sinh', 'date'],
  ['student.gender', 'Giới tính', 'string'],
  ['roster.phone', 'Số điện thoại', 'string'],
  ['applicant.citizenId', 'Số căn cước', 'string'],
  ['applicant.permanentAddress', 'Địa chỉ thường trú', 'string'],
  ['room.code', 'Mã phòng', 'string'],
  ['room.name', 'Tên phòng', 'string'],
  ['bed.code', 'Mã giường', 'string'],
  ['bed.position', 'Vị trí giường', 'string'],
] as const;

const contractVietnameseSamples: Record<string, string> = {
  'contract.code': 'HD-2026-0001',
  'contract.startDate': '01/09/2026',
  'contract.endDate': '30/06/2027',
  'contract.status': 'Hiệu lực',
  'student.code': 'SV2026001',
  'student.fullName': 'Nguyễn Thị Minh Khánh',
  'student.dateOfBirth': '02/01/2004',
  'student.gender': 'Nữ',
  'roster.phone': '0912345678',
  'applicant.citizenId': '012345678901',
  'applicant.permanentAddress': 'Hà Nội',
  'room.code': 'P101',
  'room.name': 'Phòng 101',
  'bed.code': 'G01',
  'bed.position': 'Tầng 1 - Trái',
};

function contractSyntheticValue(name: 'short' | 'long' | 'missing' | 'vietnamese', fieldKey: string, dataType: string, index: number) {
  if (name === 'missing' && index % 3 === 0) return '';
  if (dataType === 'date') return name === 'long' ? '2027-12-31' : '2026-09-01';
  if (name === 'long') return `${fieldKey} - Giá trị rất dài để kiểm tra wrap và shrink trong hợp đồng nội trú KTX`;
  if (name === 'vietnamese') return contractVietnameseSamples[fieldKey] || 'Giá trị mẫu';
  return `Mẫu HĐ ${index + 1}`;
}

export const DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR: PdfTemplateTypeDescriptor = {
  moduleCode: 'DORMITORY',
  featureCode: 'DORMITORY_CONTRACT',
  templateTypeCode: DORMITORY_RESIDENCE_CONTRACT,
  displayName: 'Mẫu đơn hợp đồng nội trú',
  sourcePermission: 'DORM_CONTRACT_READ',
  fields: contractFields.map(([fieldKey, label, dataType]) => ({
    key: fieldKey,
    label,
    dataType: dataType as any,
    sensitive: fieldKey.includes('fullName') || fieldKey.includes('citizen') || fieldKey.includes('phone') || fieldKey.includes('permanentAddress'),
    syntheticSample: fieldKey.toLowerCase().includes('date') ? '01/09/2026' : 'Giá trị mẫu',
    allowedFormatters: (fieldKey.toLowerCase().includes('date') ? ['date_ddmmyyyy'] : ['plain', ...(fieldKey.endsWith('gender') ? ['gender_vi'] : [])]) as PdfTemplateFormatter[],
    defaultStyle: { ...style, overflow: 'shrink', maxLines: 1 },
  })),
  pagePolicy: { minPages: 1, maxPages: 10, allowedDimensions: { width: 595.32, height: 842.04, tolerance: 2 } },
  syntheticFixture: (name) => ({
    name,
    values: Object.fromEntries(contractFields.map(([fieldKey, , dataType], index) => [fieldKey, contractSyntheticValue(name, fieldKey, dataType, index)])),
  }),
  resolveValues: (context: any) => resolveDormitoryContractPdfValues(context?.contract || context, context?.student, context?.room, context?.bed, context?.roster),
};

export function createDefaultDormitoryLayout(pages: Array<{ pageIndex: number; width: number; height: number; rotation: number }>): PdfTemplateLayout {
  return { pages, items: fields.map(([fieldKey], index) => { const [left, top, width, height] = bounds[index]; return { id: `ktx-${createHash('sha1').update(fieldKey).digest('hex').slice(0, 10)}`, fieldKey, formatter: fieldKey.endsWith('dateOfBirth') || fieldKey.endsWith('IssueDate') ? 'date_ddmmyyyy' : fieldKey.endsWith('gender') ? 'gender_vi' : 'plain', pageIndex: 0, x: left / 595.32, y: top / 842.04, width: width / 595.32, height: height / 842.04, rotation: 0, zIndex: index, style: { ...style, overflow: 'shrink', maxLines: 1 } }; }) };
}

export function resolveDormitoryRosterPdfValues(roster: any, student: any) {
  const profile = roster?.applicant_profile || {}; const parent = (name: string) => profile[name] || {}; const linked = roster?.identity_state === 'LINKED' && student ? student : null;
  return { 'student.fullName': linked?.full_name || roster?.full_name || '', 'student.dateOfBirth': linked?.date_bir || roster?.date_of_birth || '', 'student.gender': linked?.sex || roster?.gender || '', 'student.className': linked?.class_id?.class_name || '', 'student.faculty': linked?.class_id?.dept_id?.name || '', 'applicant.ethnicity': profile.ethnicity || '', 'applicant.religion': profile.religion || '', 'roster.phone': roster?.phone_number || '', 'applicant.citizenId': profile.citizen_id_number || '', 'applicant.citizenIssueDate': profile.citizen_id_issue_date || '', 'applicant.citizenIssuePlace': profile.citizen_id_issue_place || '', 'applicant.permanentAddress': profile.permanent_address || '', 'parent.father.name': parent('father').full_name || '', 'parent.father.age': parent('father').age || '', 'parent.father.address': parent('father').permanent_address || '', 'parent.father.contactAddress': parent('father').contact_address || '', 'parent.father.occupation': parent('father').occupation || '', 'parent.father.phone': parent('father').phone_number || '', 'parent.mother.name': parent('mother').full_name || '', 'parent.mother.age': parent('mother').age || '', 'parent.mother.address': parent('mother').permanent_address || '', 'parent.mother.contactAddress': parent('mother').contact_address || '', 'parent.mother.occupation': parent('mother').occupation || '', 'parent.mother.phone': parent('mother').phone_number || '', 'applicant.priority': profile.priority_certificate_details || '' };
}

export function resolveDormitoryResidenceInfoPdfValues(roster: any, student?: any, room?: any, bed?: any) {
  const profile = roster?.applicant_profile || {};
  const linked = roster?.identity_state === 'LINKED' && student ? student : student || null;
  const r = room || roster?.room_id || {};
  const b = bed || roster?.bed_id || {};
  return {
    'student.code': linked?.student_code || roster?.student_code || '',
    'student.fullName': linked?.full_name || roster?.full_name || '',
    'student.dateOfBirth': linked?.date_bir || roster?.date_of_birth || '',
    'student.gender': linked?.sex || roster?.gender || '',
    'student.className': linked?.class_id?.class_name || '',
    'student.faculty': linked?.class_id?.dept_id?.name || '',
    'roster.phone': roster?.phone_number || '',
    'applicant.citizenId': profile.citizen_id_number || '',
    'applicant.citizenIssueDate': profile.citizen_id_issue_date || '',
    'applicant.citizenIssuePlace': profile.citizen_id_issue_place || '',
    'applicant.permanentAddress': profile.permanent_address || '',
    'applicant.ethnicity': profile.ethnicity || '',
    'applicant.religion': profile.religion || '',
    'dormitory.semester': roster?.semester || '',
    'dormitory.academicYear': roster?.academic_year || '',
    'room.code': r?.room_code || '',
    'room.name': r?.room_name || '',
    'bed.code': b?.bed_code || '',
    'bed.position': b?.position || '',
  };
}

export function resolveDormitoryContractPdfValues(contract: any, student?: any, room?: any, bed?: any, roster?: any) {
  const s = student || contract?.student_id || {};
  const r = room || contract?.room_id || {};
  const b = bed || contract?.bed_id || {};
  const ros = roster || contract?.roster_entry_id || {};
  const profile = ros?.applicant_profile || {};
  return {
    'contract.code': contract?.contract_code || '',
    'contract.startDate': contract?.start_date || '',
    'contract.endDate': contract?.end_date || '',
    'contract.status': contract?.status || '',
    'student.code': s?.student_code || ros?.student_code || '',
    'student.fullName': s?.full_name || ros?.full_name || '',
    'student.dateOfBirth': s?.date_bir || ros?.date_of_birth || '',
    'student.gender': s?.sex || ros?.gender || '',
    'roster.phone': ros?.phone_number || '',
    'applicant.citizenId': profile?.citizen_id_number || '',
    'applicant.permanentAddress': profile?.permanent_address || '',
    'room.code': r?.room_code || '',
    'room.name': r?.room_name || '',
    'bed.code': b?.bed_code || '',
    'bed.position': b?.position || '',
  };
}

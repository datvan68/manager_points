export type RegistrationSource = 'FORMAL' | 'PUBLIC' | 'ADMIN_TEMPORARY';

export type StudentCodeState =
  | 'MISSING'
  | 'PENDING_VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LINKABLE'
  | 'LINKED';

export const FORMAL_PROTECTED_FIELDS = [
  'full_name',
  'student_code',
  'room_type',
  'notes',
] as const;

export const FORMAL_EDITABLE_FIELDS = [
  'semester',
  'academic_year',
  'date_of_birth',
  'gender',
  'phone_number',
  'preference',
  'priority_group',
  'applicant_profile',
] as const;

export const PUBLIC_EDITABLE_FIELDS = [
  'full_name',
  'student_code',
  'semester',
  'academic_year',
  'date_of_birth',
  'gender',
  'phone_number',
  'room_type',
  'priority_group',
  'notes',
  'applicant_profile',
] as const;

export const KNOWN_REGISTRATION_SOURCES: readonly RegistrationSource[] = [
  'FORMAL',
  'PUBLIC',
  'ADMIN_TEMPORARY',
];

export const CANONICAL_LINK_OWNER = 'FORMAL_REGISTRATION' as const;

export function isRegistrationSource(value: unknown): value is RegistrationSource {
  return typeof value === 'string' && KNOWN_REGISTRATION_SOURCES.includes(value as RegistrationSource);
}

export function getRegistrationEditPolicy(source: RegistrationSource, linked = false) {
  const editableFields = source === 'FORMAL'
    ? [...FORMAL_EDITABLE_FIELDS]
    : [...PUBLIC_EDITABLE_FIELDS];

  return {
    source,
    linked,
    editableFields,
    protectedFields: source === 'FORMAL' ? [...FORMAL_PROTECTED_FIELDS] : [],
    canonicalOwner: linked ? CANONICAL_LINK_OWNER : null,
  };
}

export function normalizeStudentCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

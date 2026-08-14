import { Types } from 'mongoose';
import { PublicRegistration } from './schemas/public-registration.schema';

/** Maps all public applicant fields without deriving or discarding their values. */
export function mapPublicRegistrationToFormal(publicRegistration: PublicRegistration, studentId: Types.ObjectId, status: string) {
  return {
    student_id: studentId, semester: publicRegistration.semester, academic_year: publicRegistration.academic_year,
    date_of_birth: publicRegistration.date_of_birth, gender: publicRegistration.gender,
    phone_number: publicRegistration.phone_number, room_id: publicRegistration.room_id, bed_id: publicRegistration.bed_id,
    preference: { room_type: publicRegistration.room_type, notes: publicRegistration.notes },
    priority_group: publicRegistration.priority_group, applicant_profile: publicRegistration.applicant_profile, status,
  };
}

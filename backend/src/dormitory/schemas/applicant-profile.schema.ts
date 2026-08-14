const ParentInformationSchema = {
  full_name: { type: String, trim: true }, age: { type: String, trim: true },
  permanent_address: { type: String, trim: true }, contact_address: { type: String, trim: true },
  occupation: { type: String, trim: true }, phone_number: { type: String, trim: true }, _id: false,
};
export const ApplicantProfileSchema = {
  ethnicity: { type: String, trim: true }, religion: { type: String, trim: true },
  citizen_id_number: { type: String, trim: true }, citizen_id_issue_date: { type: Date },
  citizen_id_issue_place: { type: String, trim: true }, permanent_address: { type: String, trim: true },
  father: { type: ParentInformationSchema }, mother: { type: ParentInformationSchema },
  priority_certificate_details: { type: String, trim: true }, _id: false,
};
export interface ParentInformation { full_name?: string; age?: string; permanent_address?: string; contact_address?: string; occupation?: string; phone_number?: string; }
export interface ApplicantProfile { ethnicity?: string; religion?: string; citizen_id_number?: string; citizen_id_issue_date?: Date; citizen_id_issue_place?: string; permanent_address?: string; father?: ParentInformation; mother?: ParentInformation; priority_certificate_details?: string; }

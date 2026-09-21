export type ResidentStatus = "pending" | "approved" | "rejected";

export type Resident = {
  id: string;
  user_id?: string;
  email?: string;
  full_name: string;
  birthdate?: string;
  address?: string;
  contact_number?: string;
  civil_status?: string;
  gender?: string;
  id_type?: string;
  id_image?: string;
  id_image_front?: string;
  id_image_back?: string;
  profile_image?: string;
  profile_image_original?: string;
  status: ResidentStatus;
  rejection_reason?: string;
  created_at: string;
};

export type CommunityReport = {
  id: string;
  user_id?: string;
  reporter_name?: string;
  description?: string;
  image_url?: string;
  image_urls?: string[] | string;
  category?: string;
  status?: string;
  admin_note?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  thumbnail_url?: string;
  image_urls?: string[] | string;
  is_published: boolean;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at?: string;
};

export type DocumentRequestStatus =
  | "pending"
  | "awaiting_payment"
  | "processing"
  | "ready_for_release"
  | "completed"
  | "rejected";

export type DocumentRequest = {
  id: string;
  user_id?: string;
  resident_id?: string;
  resident_name: string;
  certificate_key: string;
  certificate_title: string;
  certificate_variant?: string;
  contact_number?: string;
  email?: string;
  address?: string;
  payment_method?: string;
  payment_receiver_name?: string;
  payment_receiver_number?: string;
  payment_reference?: string;
  payment_proof_url?: string;
  payment_submitted_at?: string;
  fee_label?: string;
  fee_amount?: number;
  purpose?: string;
  additional_notes?: string;
  form_data?: Record<string, unknown> | string;
  rejection_reason?: string;
  status: DocumentRequestStatus;
  created_at: string;
  updated_at?: string;
};

export type UserRole = 'caregiver' | 'elderly';

export interface Medication {
  id: string;
  profileId: string;
  name: string;
  dosage?: string;
  instructions?: string;
  times: string[];
  endDate?: string;
  purpose?: string;
  stockTotal?: number;
  packageCapacity?: number;
  unitsPerDose?: number;
  isActive?: boolean;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  profileId: string;
  scheduledTime: string;
  date: string;
  status: 'pending' | 'unresponded' | 'postponed' | 'taken' | 'caregiver_marked';
  takenAt?: string | null;
}

export interface Appointment {
  id: string;
  profileId: string;
  title: string;
  location?: string;
  doctorName?: string;
  date: string;
  time: string;
  notes?: string;
  status?: string;
}

export interface HealthValueData {
  systolic?: number;
  diastolic?: number;
  sugar?: number;
  weight?: number;
}

export interface HealthRecord {
  id: string;
  profileId: string;
  recordType: 'blood_pressure' | 'blood_sugar' | 'weight';
  valueData: HealthValueData;
  measuredAt: string;
  recordedBy?: string;
}

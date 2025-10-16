import { Request } from 'express';
import { IUser, IClinic, IUserClinic, ITenantSubscription } from '../models';

export interface AuthRequest extends Request {
  user?: IUser & {
    id: string;
    email: string;
    clinic_id?: string;
    user_clinic?: any;
    permissions?: string[];
    roles?: string[];
    is_admin?: boolean;
  };
  clinic?: {
    id: string;
    name: string;
  };
  clinic_id?: string; // Current selected clinic ID
  tenant_id?: string; // Current user's tenant ID for multi-tenancy
  userClinics?: IUserClinic[]; // All clinics user has access to
  currentUserClinic?: IUserClinic; // Current user-clinic relationship
  currentClinic?: IClinic; // Current selected clinic details
  subscription?: ITenantSubscription; // Current tenant's subscription info
  // Super Admin specific properties
  isSuperAdmin?: boolean; // Flag to identify super admin requests
  superAdminId?: string; // Super admin ID if authenticated as super admin
} 
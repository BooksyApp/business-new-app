import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** A prepaid block of sessions a salon sells over the counter (distinct from a recurring membership). */
export interface ServicePackage {
  id: Id;
  business_id: Id;
  name: string;
  description: string | null;
  service_id: Id | null;
  sessions_total: number;
  price: number;
  valid_days: number | null;
  active: boolean;
}

export interface ServicePackageInput {
  name: string;
  description?: string;
  serviceId?: Id | null;
  sessionsTotal: number;
  price: number;
  validDays?: number | null;
}

class PackageService {
  list(businessId: Id): Promise<ServicePackage[]> {
    return apiClient.get<ServicePackage[]>(`/packages/business/${businessId}`);
  }
  create(businessId: Id, input: ServicePackageInput): Promise<ServicePackage> {
    return apiClient.post<ServicePackage>(`/packages/business/${businessId}`, input);
  }
  /** Retire or restore a package. Sessions already sold stay usable. */
  setActive(businessId: Id, id: Id, active: boolean): Promise<void> {
    return apiClient.post<void>(`/packages/business/${businessId}/${id}/active`, { active });
  }
}

export const packageService = new PackageService();

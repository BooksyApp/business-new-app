import { apiClient } from "@/config/api";

/**
 * #43: ResourceTypeController has existed with list/create/deactivate and nothing on
 * the client ever called it, so a salon could not record the shared equipment its
 * bookings depend on — chairs, washbasins, lasers. The RESOURCES tab that would have
 * shown them was commented out.
 */
export interface ResourceType {
  id: number;
  businessId: number;
  name: string;
  quantity: number;
  isActive: boolean;
}

class ResourceTypeService {
  async list(businessId: number): Promise<ResourceType[]> {
    return apiClient.get<ResourceType[]>(`/resource-types/business/${businessId}`);
  }

  async create(businessId: number, name: string, quantity: number): Promise<ResourceType> {
    return apiClient.post<ResourceType>(`/resource-types/business/${businessId}`, {
      businessId,
      name,
      quantity,
    });
  }

  /** Soft-delete: the backend deactivates rather than removing, so bookings keep resolving. */
  async deactivate(businessId: number, id: number): Promise<void> {
    return apiClient.delete<void>(`/resource-types/business/${businessId}/${id}`);
  }
}

export const resourceTypeService = new ResourceTypeService();

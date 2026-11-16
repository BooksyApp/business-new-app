import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/**
 * #43: ResourceTypeController has existed with list/create/deactivate and nothing on
 * the client ever called it, so a salon could not record the shared equipment its
 * bookings depend on — chairs, washbasins, lasers. The RESOURCES tab that would have
 * shown them was commented out.
 */
export interface ResourceType {
  id: Id;
  businessId: Id;
  name: string;
  quantity: number;
  isActive: boolean;
}

class ResourceTypeService {
  async list(businessId: Id): Promise<ResourceType[]> {
    return apiClient.get<ResourceType[]>(`/resource-types/business/${businessId}`);
  }

  async create(businessId: Id, name: string, quantity: number): Promise<ResourceType> {
    return apiClient.post<ResourceType>(`/resource-types/business/${businessId}`, {
      businessId,
      name,
      quantity,
    });
  }

  /** Soft-delete: the backend deactivates rather than removing, so bookings keep resolving. */
  async deactivate(businessId: Id, id: Id): Promise<void> {
    return apiClient.delete<void>(`/resource-types/business/${businessId}/${id}`);
  }
}

export const resourceTypeService = new ResourceTypeService();

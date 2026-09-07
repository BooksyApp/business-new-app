import { apiClient } from "@/config/api";

export interface BusinessCategory {
  slug: string;
  name: string;
}

/**
 * The categories a salon can belong to.
 *
 * They used to be two hardcoded arrays in the signup wizard and a free-text box on the
 * business profile, so the same trade was stored three different ways and the customer
 * app — which groups salons by this field — showed each spelling as its own category.
 */
class CategoryService {
  async list(): Promise<BusinessCategory[]> {
    return apiClient.get<BusinessCategory[]>(`/public/business-categories`);
  }
}

export const categoryService = new CategoryService();

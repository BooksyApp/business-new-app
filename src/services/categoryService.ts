import { apiClient } from "@/config/api";

/** A salon's own service category (Hair, Colour, …) — not the salon-type list above. */
export interface Category {
  id: number;
  businessId: number;
  name: string;
  description?: string;
  color?: string;
  displayOrder?: number;
  isVisible: boolean;
  serviceCount?: number;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  color?: string;
  isVisible?: boolean;
}

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
    // Public, and read by the sign-up page before there is any account: asking for auth
    // here bounced every new salon owner to the login screen.
    return apiClient.get<BusinessCategory[]>(`/public/business-categories`, false);
  }

  // Service categories. fe55021 rewrote this file for the salon-type list and dropped
  // these, which left useCategories and the till calling methods that no longer existed.
  async getCategoriesByBusiness(businessId: number): Promise<Category[]> {
    return apiClient.get<Category[]>(`/categories/business/${businessId}`);
  }

  async createCategory(businessId: number, request: CreateCategoryRequest): Promise<Category> {
    return apiClient.post<Category>(`/categories/business/${businessId}`, request);
  }

  async updateCategory(id: number, businessId: number, request: UpdateCategoryRequest): Promise<Category> {
    return apiClient.put<Category>(`/categories/${id}/business/${businessId}`, request);
  }

  async deleteCategory(id: number, businessId: number): Promise<void> {
    return apiClient.delete<void>(`/categories/${id}/business/${businessId}`);
  }
}

export const categoryService = new CategoryService();

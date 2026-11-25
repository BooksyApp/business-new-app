import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";
import { getLocale } from "@/i18n";

/** A salon's own service category (Hair, Colour, …) — not the salon-type list above. */
export interface Category {
  id: Id;
  businessId: Id;
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
  /** The stable English key salons store. Never show it; show `label`. */
  name: string;
  /** The name in the panel language (falls back to English server-side). */
  label?: string;
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
    return apiClient.get<BusinessCategory[]>(`/public/business-categories?locale=${getLocale()}`, false);
  }

  // Service categories. fe55021 rewrote this file for the salon-type list and dropped
  // these, which left useCategories and the till calling methods that no longer existed.
  async getCategoriesByBusiness(businessId: Id): Promise<Category[]> {
    return apiClient.get<Category[]>(`/categories/business/${businessId}`);
  }

  async createCategory(businessId: Id, request: CreateCategoryRequest): Promise<Category> {
    return apiClient.post<Category>(`/categories/business/${businessId}`, request);
  }

  async updateCategory(id: Id, businessId: Id, request: UpdateCategoryRequest): Promise<Category> {
    return apiClient.put<Category>(`/categories/${id}/business/${businessId}`, request);
  }

  async deleteCategory(id: Id, businessId: Id): Promise<void> {
    return apiClient.delete<void>(`/categories/${id}/business/${businessId}`);
  }
}

export const categoryService = new CategoryService();

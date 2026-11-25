import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export interface Product {
  id: Id;
  businessId: Id;
  name: string;
  sku: string | null;
  price: number;
  quantityOnHand: number;
  lowStockThreshold: number;
  isActive: boolean;
  lowStock: boolean;
}

export interface ProductInput {
  name: string;
  sku?: string;
  price: number;
  quantityOnHand: number;
  lowStockThreshold: number;
  isActive?: boolean;
}

/**
 * Retail stock — shampoo, styling products, anything with a SKU and a count.
 *
 * The backend has had this since #290 (V59: products, quantity_on_hand, low stock
 * threshold, and a decrementStock hook for sales). Nothing in the manager app called it:
 * the page labelled "Inventory" was the add-on editor, so a salon could not see or count
 * a single bottle.
 */
class ProductService {
  list(businessId: Id): Promise<Product[]> {
    return apiClient.get<Product[]>(`/products/business/${businessId}`);
  }

  lowStock(businessId: Id): Promise<Product[]> {
    return apiClient.get<Product[]>(`/products/business/${businessId}/low-stock`);
  }

  create(businessId: Id, input: ProductInput): Promise<Product> {
    return apiClient.post<Product>(`/products/business/${businessId}`, input);
  }

  /** A partial update is fine: the server keeps fields that are not sent. */
  update(businessId: Id, id: Id, input: Partial<ProductInput>): Promise<Product> {
    return apiClient.put<Product>(`/products/${id}/business/${businessId}`, input);
  }

  remove(businessId: Id, id: Id): Promise<void> {
    return apiClient.delete<void>(`/products/${id}/business/${businessId}`);
  }
}

export const productService = new ProductService();

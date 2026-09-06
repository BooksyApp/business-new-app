import { apiClient } from "@/config/api";

/**
 * #26/#44: ProductController has had list, low-stock, create, update and delete all
 * along — with SKU, quantity on hand, a low-stock threshold and a computed lowStock
 * flag — and nothing on the client ever called it. The sidebar's "Inventory" link
 * opened add-on service management instead, so a salon owner looking for retail stock
 * found something else entirely.
 */
export interface Product {
  id: number;
  businessId: number;
  name: string;
  sku: string | null;
  price: number;
  quantityOnHand: number;
  lowStockThreshold: number;
  isActive: boolean;
  /** Computed server-side: quantityOnHand <= lowStockThreshold. */
  lowStock: boolean;
}

export interface ProductRequest {
  name: string;
  sku?: string;
  price: number;
  quantityOnHand: number;
  lowStockThreshold: number;
  isActive?: boolean;
}

class ProductService {
  async list(businessId: number): Promise<Product[]> {
    return apiClient.get<Product[]>(`/products/business/${businessId}`);
  }

  async lowStock(businessId: number): Promise<Product[]> {
    return apiClient.get<Product[]>(`/products/business/${businessId}/low-stock`);
  }

  async create(businessId: number, body: ProductRequest): Promise<Product> {
    return apiClient.post<Product>(`/products/business/${businessId}`, body);
  }

  async update(id: number, businessId: number, body: Partial<ProductRequest>): Promise<Product> {
    return apiClient.put<Product>(`/products/${id}/business/${businessId}`, body);
  }

  async remove(id: number, businessId: number): Promise<void> {
    return apiClient.delete<void>(`/products/${id}/business/${businessId}`);
  }
}

export const productService = new ProductService();

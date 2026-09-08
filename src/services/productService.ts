import { apiClient } from "@/config/api";

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  brand: string | null;
  cost_price: number;
  sale_price: number;
  quantity: number;
  reorder_level: number;
  unit: string | null;
  active: boolean;
  low_stock: boolean;
}

export interface StockMovement {
  delta: number;
  reason: string;
  note: string | null;
  created_at: string;
}

export interface ProductInput {
  name: string;
  sku?: string;
  brand?: string;
  costPrice?: number;
  salePrice?: number;
  quantity?: number;
  reorderLevel?: number;
  unit?: string;
  active?: boolean;
}

/**
 * Stock, not add-ons.
 *
 * "Inventory" used to be the add-on editor with a different title — no SKU, no quantity,
 * no reorder level. This is the real thing: what the salon buys, counts and sells.
 */
class ProductService {
  list(businessId: number): Promise<Product[]> {
    return apiClient.get<Product[]>(`/businesses/${businessId}/products`);
  }

  create(businessId: number, input: ProductInput): Promise<Product> {
    return apiClient.post<Product>(`/businesses/${businessId}/products`, input);
  }

  update(businessId: number, id: number, input: Partial<ProductInput>): Promise<Product> {
    return apiClient.put<Product>(`/businesses/${businessId}/products/${id}`, input);
  }

  remove(businessId: number, id: number): Promise<void> {
    return apiClient.delete<void>(`/businesses/${businessId}/products/${id}`);
  }

  movements(businessId: number, id: number): Promise<StockMovement[]> {
    return apiClient.get<StockMovement[]>(`/businesses/${businessId}/products/${id}/movements`);
  }

  /** Moves stock and records why. The count is never set directly — see the server. */
  move(businessId: number, id: number, delta: number, reason: string, note?: string): Promise<Product> {
    return apiClient.post<Product>(`/businesses/${businessId}/products/${id}/movements`, {
      delta,
      reason,
      note,
    });
  }
}

export const productService = new ProductService();

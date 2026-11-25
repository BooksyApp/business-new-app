import type { Id } from "@/types/id";
import { useState, useEffect, useCallback } from 'react';
import { categoryService, type Category, type CreateCategoryRequest, type UpdateCategoryRequest } from '@/services/categoryService';
import { useBusinessId } from '@/hooks/useBusinessId';
import { toast } from 'sonner';
import { t } from "@/i18n";

export function useCategories(businessIdParam?: Id) {
  const routeBusinessId = useBusinessId();
  const businessId = businessIdParam ?? routeBusinessId;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await categoryService.getCategoriesByBusiness(businessId);
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError((err instanceof Error && err.message) || t("hooks.failedToLoadCategories"));
      toast.error(t("hooks.failedToLoadCategories"));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const createCategory = useCallback(async (request: CreateCategoryRequest) => {
    try {
      const created = await categoryService.createCategory(businessId, request);
      setCategories(prev => [...prev, created]);
      toast.success(t("hooks.categoryCreatedSuccessfully"));
      return created;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToCreateCategory"));
      throw err;
    }
  }, [businessId]);

  const updateCategory = useCallback(async (id: Id, request: UpdateCategoryRequest) => {
    try {
      const updated = await categoryService.updateCategory(id, businessId, request);
      setCategories(prev => prev.map(cat => cat.id === id ? updated : cat));
      toast.success(t("hooks.categoryUpdatedSuccessfully"));
      return updated;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToUpdateCategory"));
      throw err;
    }
  }, [businessId]);

  const deleteCategory = useCallback(async (id: Id) => {
    try {
      await categoryService.deleteCategory(id, businessId);
      setCategories(prev => prev.filter(cat => cat.id !== id));
      toast.success(t("hooks.categoryDeletedSuccessfully"));
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToDeleteCategory"));
      throw err;
    }
  }, [businessId]);

  return {
    categories,
    loading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    refresh: loadCategories,
  };
}




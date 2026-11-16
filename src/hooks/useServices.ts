import type { Id } from "@/types/id";
import { useState, useEffect, useCallback } from 'react';
import { serviceService, type Service, type CreateServiceRequest, type UpdateServiceRequest } from '@/services/serviceService';
import { useBusinessId } from '@/hooks/useBusinessId';
import { toast } from 'sonner';
import { t } from "@/i18n";

export function useServices(businessIdParam?: Id, categoryId?: Id) {
  const routeBusinessId = useBusinessId();
  const businessId = businessIdParam ?? routeBusinessId;
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    if (!businessId) {
      setError(t("common.businessIdIsRequired"));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = categoryId 
        ? await serviceService.getServicesByCategory(categoryId)
        : await serviceService.getServicesByBusiness(businessId);
      setServices(data);
    } catch (err) {
      console.error('Failed to load services:', err);
      setError((err instanceof Error && err.message) || t("hooks.failedToLoadServices"));
      toast.error(t("hooks.failedToLoadServices"));
    } finally {
      setLoading(false);
    }
  }, [businessId, categoryId]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const createService = useCallback(async (request: CreateServiceRequest) => {
    if (!businessId) {
      const error = new Error(t("common.businessIdIsRequired"));
      toast.error(error.message);
      throw error;
    }
    try {
      const created = await serviceService.createService(businessId, request);
      setServices(prev => [...prev, created]);
      toast.success(t("hooks.serviceCreatedSuccessfully"));
      return created;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToCreateService"));
      throw err;
    }
  }, [businessId]);

  const updateService = useCallback(async (id: Id, request: UpdateServiceRequest) => {
    try {
      const updated = await serviceService.updateService(id, businessId, request);
      setServices(prev => prev.map(svc => svc.id === id ? updated : svc));
      toast.success(t("hooks.serviceUpdatedSuccessfully"));
      return updated;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToUpdateService"));
      throw err;
    }
  }, [businessId]);

  const deleteService = useCallback(async (id: Id) => {
    try {
      await serviceService.deleteService(id, businessId);
      setServices(prev => prev.filter(svc => svc.id !== id));
      toast.success(t("hooks.serviceDeletedSuccessfully"));
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToDeleteService"));
      throw err;
    }
  }, [businessId]);

  return {
    services,
    loading,
    error,
    createService,
    updateService,
    deleteService,
    refresh: loadServices,
  };
}




import { useState, useEffect, useCallback } from 'react';
import { addonService, type Addon, type CreateAddonRequest, type UpdateAddonRequest } from '@/services/addonService';
import { useBusinessId } from '@/hooks/useBusinessId';
import { toast } from 'sonner';
import { t } from "@/i18n";

export function useAddons(businessIdParam?: number) {
  const routeBusinessId = useBusinessId();
  const businessId = businessIdParam ?? routeBusinessId;
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAddons = useCallback(async () => {
    if (!businessId || businessId <= 0) {
      setError(t("common.businessIdIsRequired"));
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await addonService.getAddonsByBusiness(businessId);
      setAddons(data);
    } catch (err) {
      console.error('Failed to load addons:', err);
      setError((err instanceof Error && err.message) || t("hooks.failedToLoadAddons"));
      toast.error(t("hooks.failedToLoadAddons"));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadAddons();
  }, [loadAddons]);

  const createAddon = useCallback(async (request: CreateAddonRequest) => {
    if (!businessId || businessId <= 0) {
      const error = new Error(t("common.businessIdIsRequired"));
      toast.error(error.message);
      throw error;
    }
    try {
      const created = await addonService.createAddon(businessId, request);
      setAddons(prev => [...prev, created]);
      toast.success(t("hooks.addonCreatedSuccessfully"));
      return created;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToCreateAddon"));
      throw err;
    }
  }, [businessId]);

  const updateAddon = useCallback(async (id: number, request: UpdateAddonRequest) => {
    try {
      const updated = await addonService.updateAddon(id, businessId, request);
      setAddons(prev => prev.map(addon => addon.id === id ? updated : addon));
      toast.success(t("hooks.addonUpdatedSuccessfully"));
      return updated;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToUpdateAddon"));
      throw err;
    }
  }, [businessId]);

  const deleteAddon = useCallback(async (id: number) => {
    try {
      await addonService.deleteAddon(id, businessId);
      setAddons(prev => prev.filter(addon => addon.id !== id));
      toast.success(t("hooks.addonDeletedSuccessfully"));
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToDeleteAddon"));
      throw err;
    }
  }, [businessId]);

  return {
    addons,
    loading,
    error,
    createAddon,
    updateAddon,
    deleteAddon,
    refresh: loadAddons,
  };
}



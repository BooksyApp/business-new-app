import type { Id } from "@/types/id";
import { useState, useEffect, useCallback } from 'react';
import { shiftService, type Shift, type CreateShiftRequest, type UpdateShiftRequest } from '@/services/shiftService';
import { useBusinessId } from '@/hooks/useBusinessId';
import { toast } from 'sonner';
import { t } from "@/i18n";

export function useShifts(businessIdParam?: Id, date?: string) {
  const routeBusinessId = useBusinessId();
  const businessId = businessIdParam ?? routeBusinessId;
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShifts = useCallback(async () => {
    if (!businessId || !date) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await shiftService.getShiftsByBusinessAndDate(businessId, date);
      setShifts(data);
    } catch (err) {
      console.error('Failed to load shifts:', err);
      setError((err instanceof Error && err.message) || t("hooks.failedToLoadShifts"));
      toast.error(t("hooks.failedToLoadShifts"));
    } finally {
      setLoading(false);
    }
  }, [businessId, date]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const createShift = useCallback(async (request: CreateShiftRequest) => {
    if (!businessId) {
      const error = new Error(t("common.businessIdIsRequired"));
      toast.error(error.message);
      throw error;
    }
    try {
      const created = await shiftService.createShift(businessId, request);
      setShifts(prev => [...prev, created]);
      toast.success(t("hooks.shiftCreatedSuccessfully"));
      return created;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToCreateShift"));
      throw err;
    }
  }, [businessId]);

  const updateShift = useCallback(async (id: Id, request: UpdateShiftRequest) => {
    if (!businessId) {
      const error = new Error(t("common.businessIdIsRequired"));
      toast.error(error.message);
      throw error;
    }
    try {
      const updated = await shiftService.updateShift(id, businessId, request);
      setShifts(prev => prev.map(s => s.id === id ? updated : s));
      toast.success(t("hooks.shiftUpdatedSuccessfully"));
      return updated;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToUpdateShift"));
      throw err;
    }
  }, [businessId]);

  const deleteShift = useCallback(async (id: Id) => {
    if (!businessId) {
      const error = new Error(t("common.businessIdIsRequired"));
      toast.error(error.message);
      throw error;
    }
    try {
      await shiftService.deleteShift(id, businessId);
      setShifts(prev => prev.filter(s => s.id !== id));
      toast.success(t("hooks.shiftDeletedSuccessfully"));
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToDeleteShift"));
      throw err;
    }
  }, [businessId]);

  return {
    shifts,
    loading,
    error,
    createShift,
    updateShift,
    deleteShift,
    refresh: loadShifts,
  };
}



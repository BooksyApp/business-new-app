import { useState, useEffect, useCallback } from 'react';
import { staffService, type Staff, type CreateStaffRequest, type UpdateStaffRequest } from '@/services/staffService';
import { useBusinessId } from '@/hooks/useBusinessId';
import { toast } from 'sonner';
import { t } from "@/i18n";

export function useStaff(businessIdParam?: number) {
  const routeBusinessId = useBusinessId();
  const businessId = businessIdParam ?? routeBusinessId;
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await staffService.getStaffByBusiness(businessId);
      setStaff(data);
    } catch (err) {
      console.error('Failed to load staff:', err);
      setError((err instanceof Error && err.message) || t("hooks.failedToLoadStaff"));
      toast.error(t("hooks.failedToLoadStaff"));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const createStaff = useCallback(async (request: CreateStaffRequest) => {
    try {
      const created = await staffService.createStaff(businessId, request);
      setStaff(prev => [...prev, created]);
      // No toast here: the add-staff page says what happened (added / invited / no invitation).
      return created;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToCreateStaffMember"));
      throw err;
    }
  }, [businessId]);

  const updateStaff = useCallback(async (id: number, request: UpdateStaffRequest) => {
    try {
      const updated = await staffService.updateStaff(id, businessId, request);
      setStaff(prev => prev.map(s => s.id === id ? updated : s));
      toast.success(t("hooks.staffMemberUpdatedSuccessfully"));
      return updated;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToUpdateStaffMember"));
      throw err;
    }
  }, [businessId]);

  const deleteStaff = useCallback(async (id: number) => {
    try {
      await staffService.deleteStaff(id, businessId);
      setStaff(prev => prev.filter(s => s.id !== id));
      toast.success(t("hooks.staffMemberDeletedSuccessfully"));
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToDeleteStaffMember"));
      throw err;
    }
  }, [businessId]);

  // #13/#293: separate endpoint from updateStaff — see staffService.setRole.
  const setStaffRole = useCallback(async (id: number, role: string) => {
    const updated = await staffService.setRole(id, role);
    setStaff(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  }, []);

  return {
    staff,
    loading,
    error,
    createStaff,
    updateStaff,
    deleteStaff,
    setStaffRole,
    refresh: loadStaff,
  };
}




import type { Id } from "@/types/id";
import { useState, useEffect, useCallback } from 'react';
import { commissionService, Commission, CommissionRule, CommissionCategory, CommissionStatus } from '@/services/commissionService';
import { useBusinessId } from './useBusinessId';
import { t } from "@/i18n";

interface UseCommissionsOptions {
  staffId?: Id;
  businessId?: Id;
}

export const useCommissions = (options?: UseCommissionsOptions) => {
  const defaultBusinessId = useBusinessId();
  const businessId = options?.businessId || defaultBusinessId;
  const staffId = options?.staffId;

  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [pendingCommissions, setPendingCommissions] = useState<Commission[]>([]);
  const [totalPending, setTotalPending] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadCommissions = useCallback(async () => {
    if (!businessId || !staffId) return;

    setLoading(true);
    setError(null);
    try {
      const [allCommissions, pending, total] = await Promise.all([
        commissionService.getCommissionsByStaff(businessId, staffId),
        commissionService.getPendingCommissions(businessId, staffId),
        commissionService.getTotalPendingCommission(businessId, staffId),
      ]);
      setCommissions(allCommissions);
      setPendingCommissions(pending);
      setTotalPending(total);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToLoadCommissions")));
      console.error('Error loading commissions:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, staffId]);

  useEffect(() => {
    loadCommissions();
  }, [loadCommissions]);

  const refresh = useCallback(() => {
    loadCommissions();
  }, [loadCommissions]);

  const getCommissionsByDateRange = useCallback(async (startDate: string, endDate: string) => {
    if (!businessId || !staffId) return [];

    setLoading(true);
    setError(null);
    try {
      const result = await commissionService.getCommissionsByDateRange(businessId, staffId, startDate, endDate);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToLoadCommissionsBy")));
      console.error('Error loading commissions by date range:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [businessId, staffId]);

  const calculateCommission = useCallback(async (
    appointmentId: string,
    serviceId: Id,
    saleAmount: number
  ) => {
    if (!businessId || !staffId) return null;

    setLoading(true);
    setError(null);
    try {
      const commission = await commissionService.calculateCommission(
        businessId,
        staffId,
        appointmentId,
        serviceId,
        saleAmount
      );
      await refresh();
      return commission;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToCalculateCommission")));
      console.error('Error calculating commission:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, staffId, refresh]);

  const cancelCommission = useCallback(async (id: Id) => {
    setLoading(true);
    setError(null);
    try {
      await commissionService.cancelCommission(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToCancelCommission")));
      console.error('Error cancelling commission:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  return {
    commissions,
    pendingCommissions,
    totalPending,
    loading,
    error,
    refresh,
    getCommissionsByDateRange,
    calculateCommission,
    cancelCommission,
  };
};

export const useCommissionRules = (businessId?: Id) => {
  const defaultBusinessId = useBusinessId();
  const bid = businessId || defaultBusinessId;

  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadRules = useCallback(async () => {
    if (!bid) return;

    setLoading(true);
    setError(null);
    try {
      const result = await commissionService.getCommissionRules(bid);
      setRules(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToLoadCommissionRules")));
      console.error('Error loading commission rules:', err);
    } finally {
      setLoading(false);
    }
  }, [bid]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const getRulesByCategory = useCallback(async (category: CommissionCategory) => {
    if (!bid) return [];

    setLoading(true);
    setError(null);
    try {
      const result = await commissionService.getCommissionRulesByCategory(bid, category);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToLoadCommissionRules2")));
      console.error('Error loading commission rules by category:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [bid]);

  const getRulesByStaff = useCallback(async (staffId: Id) => {
    if (!bid) return [];

    setLoading(true);
    setError(null);
    try {
      const result = await commissionService.getCommissionRulesByStaff(bid, staffId);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToLoadCommissionRules3")));
      console.error('Error loading commission rules by staff:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [bid]);

  const createRule = useCallback(async (rule: Omit<CommissionRule, 'id'>) => {
    if (!bid) return null;

    setLoading(true);
    setError(null);
    try {
      const result = await commissionService.createCommissionRule({ ...rule, businessId: bid });
      await loadRules();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToCreateCommissionRule")));
      console.error('Error creating commission rule:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [bid, loadRules]);

  const updateRule = useCallback(async (id: Id, rule: Partial<CommissionRule>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await commissionService.updateCommissionRule(id, rule);
      await loadRules();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToUpdateCommissionRule")));
      console.error('Error updating commission rule:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadRules]);

  const deleteRule = useCallback(async (id: Id) => {
    setLoading(true);
    setError(null);
    try {
      await commissionService.deleteCommissionRule(id);
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToDeleteCommissionRule")));
      console.error('Error deleting commission rule:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadRules]);

  const deactivateRule = useCallback(async (id: Id) => {
    setLoading(true);
    setError(null);
    try {
      await commissionService.deactivateCommissionRule(id);
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToDeactivateCommissionRule")));
      console.error('Error deactivating commission rule:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadRules]);

  const deleteAllRules = useCallback(async () => {
    if (!bid) return;

    setLoading(true);
    setError(null);
    try {
      await commissionService.deleteAllCommissionRules(bid);
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t("hooks.failedToDeleteAllCommission")));
      console.error('Error deleting all commission rules:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [bid, loadRules]);

  return {
    rules,
    loading,
    error,
    refresh: loadRules,
    getRulesByCategory,
    getRulesByStaff,
    createRule,
    updateRule,
    deleteRule,
    deactivateRule,
    deleteAllRules,
  };
};


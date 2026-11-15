import { useState, useEffect, useCallback } from "react";
import { timeOffService, type TimeOff, type CreateTimeOffRequest, type UpdateTimeOffRequest } from "@/services/timeOffService";
import { websocketService } from "@/services/websocketService";
import { toast } from "sonner";
import { useBusinessId } from "@/hooks/useBusinessId";
import { t } from "@/i18n";

export const useTimeOff = (businessIdParam?: number) => {
  const routeBusinessId = useBusinessId();
  const businessId = businessIdParam ?? routeBusinessId;
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeOffs = useCallback(async () => {
    if (!businessId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await timeOffService.getTimeOffsByBusiness(businessId);
      setTimeOffs(data);
    } catch (err) {
      setError((err instanceof Error && err.message) || t("hooks.failedToFetchTimeOffs"));
      console.error("Error fetching time offs:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchTimeOffs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]); // Only depend on businessId, not fetchTimeOffs to avoid infinite loop

  // WebSocket subscription for real-time updates
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupWebSocket = async () => {
      try {
        await websocketService.connect();
        
        unsubscribe = websocketService.subscribeToTimeOffs(businessId, (timeOffData: TimeOff) => {
          // Check if this is a delete event (only has id and businessId)
          if (timeOffData.id && !timeOffData.startDate && !timeOffData.reason) {
            // This is likely a delete event
            setTimeOffs(prev => prev.filter(to => to.id !== timeOffData.id));
            return;
          }
          
          // Update or add time off
          setTimeOffs(prev => {
            const existing = prev.findIndex(to => to.id === timeOffData.id);
            if (existing >= 0) {
              // Update existing
              const updated = [...prev];
              updated[existing] = timeOffData;
              return updated;
            } else {
              // Add new
              return [...prev, timeOffData];
            }
          });
        });
      } catch (err) {
        console.warn('WebSocket connection failed:', err);
      }
    };

    setupWebSocket();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [businessId]);

  const createTimeOff = useCallback(async (data: CreateTimeOffRequest): Promise<TimeOff | null> => {
    try {
      const newTimeOff = await timeOffService.createTimeOff(data);
      // WebSocket will handle the update, but we can add it optimistically
      setTimeOffs(prev => {
        const exists = prev.find(to => to.id === newTimeOff.id);
        if (!exists) {
          return [...prev, newTimeOff];
        }
        return prev;
      });
      toast.success(t("hooks.timeOffCreatedSuccessfully"));
      return newTimeOff;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToCreateTimeOff"));
      return null;
    }
  }, []);

  const updateTimeOff = useCallback(async (id: number, data: UpdateTimeOffRequest): Promise<TimeOff | null> => {
    try {
      const updated = await timeOffService.updateTimeOff(id, data);
      setTimeOffs(prev => prev.map(to => to.id === id ? updated : to));
      toast.success(t("hooks.timeOffUpdatedSuccessfully"));
      return updated;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToUpdateTimeOff"));
      return null;
    }
  }, []);

  const deleteTimeOff = useCallback(async (id: number): Promise<boolean> => {
    try {
      await timeOffService.deleteTimeOff(id);
      // WebSocket will handle the update, but we can remove it optimistically
      setTimeOffs(prev => prev.filter(to => to.id !== id));
      toast.success(t("hooks.timeOffDeletedSuccessfully"));
      return true;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToDeleteTimeOff"));
      return false;
    }
  }, []);

  const approveTimeOff = useCallback(async (id: number, approvedBy: number): Promise<TimeOff | null> => {
    try {
      const approved = await timeOffService.approveTimeOff(id, approvedBy);
      setTimeOffs(prev => prev.map(to => to.id === id ? approved : to));
      toast.success(t("hooks.timeOffApprovedSuccessfully"));
      return approved;
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToApproveTimeOff"));
      return null;
    }
  }, []);

  return {
    timeOffs,
    loading,
    error,
    fetchTimeOffs,
    createTimeOff,
    updateTimeOff,
    deleteTimeOff,
    approveTimeOff,
  };
};



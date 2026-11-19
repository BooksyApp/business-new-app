import type { Id } from "@/types/id";
import { useState, useEffect, useCallback, useRef } from 'react';
import { appointmentService, BookingConflictDeclined, type Appointment as ApiAppointment } from '@/services/appointmentService';
import { staffService, type Staff as ApiStaff } from '@/services/staffService';
import { websocketService } from '@/services/websocketService';
import { useBusinessId } from '@/hooks/useBusinessId';
import { toast } from 'sonner';
import { parse } from 'date-fns';
import { format } from '@/i18n/dateFns';
import { t } from "@/i18n";

// Frontend appointment type (compatible with AppointmentBlock)
export interface Appointment {
  id: string;
  clientName: string;
  clientAlert?: boolean;
  service: string;
  startTime: string;
  endTime: string;
  staffId: string;
  staffName?: string;
  color: string;
  date: Date;
  apiId?: string; // For API operations
  clientPhone?: string;
  clientEmail?: string;
  notes?: string;
  price?: number;
  // #30: drives which lifecycle actions the calendar modal offers.
  status?: string;
  clientId?: Id;
  serviceId?: Id;
  /** Shared by every service booked in one multi-service visit. */
  visitId?: string | null;
  isClass?: boolean;
  answers?: { question: string; answer: string }[];
  cancelledBy?: string | null;
  cancellationNote?: string | null;
  overrideApplied?: boolean;
  overrideReason?: string | null;
  overrideByName?: string | null;
}

// Frontend staff type
export interface Staff {
  id: string;
  name: string;
  avatar: string;
  initials?: string;
  workingHours?: string;
}

// Convert API appointment to frontend format
const convertAppointment = (apiAppt: ApiAppointment, date: Date): Appointment => {
  return {
    id: apiAppt.id.toString(),
    clientName: apiAppt.clientName || t("sales.walkInClient"),
    clientAlert: apiAppt.clientAlert === true,
    service: apiAppt.serviceName || 'Service',
    startTime: apiAppt.startTime,
    endTime: apiAppt.endTime,
    staffId: apiAppt.staffId.toString(),
    staffName: apiAppt.staffName,
    color: apiAppt.color || 'green',
    date: date,
    apiId: apiAppt.id,
    // Additional fields
    clientId: apiAppt.clientId,
    clientPhone: apiAppt.clientPhone,
    clientEmail: apiAppt.clientEmail,
    notes: apiAppt.notes,
    price: apiAppt.price,
    status: apiAppt.status,   // #30
    serviceId: apiAppt.serviceId,
    visitId: apiAppt.visitId ?? null,
    isClass: apiAppt.isClass ?? false,
    answers: apiAppt.answers,
    cancelledBy: apiAppt.cancelledBy,
    cancellationNote: apiAppt.cancellationNote,
    overrideApplied: !!apiAppt.overrideApplied,
    overrideReason: apiAppt.overrideReason,
    overrideByName: apiAppt.overrideByName,
  };
};

// Convert API staff to frontend format
const convertStaff = (apiStaff: ApiStaff): Staff => {
  return {
    id: apiStaff.id.toString(),
    name: apiStaff.name,
    avatar: apiStaff.avatarUrl || '',
    initials: apiStaff.initials,
    workingHours: apiStaff.workingHours,
  };
};

export function useAppointments(businessIdParam?: Id, date?: Date) {
  const routeBusinessId = useBusinessId();
  const businessId = businessIdParam ?? routeBusinessId;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [websocketStatus, setWebsocketStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const seenAppointmentIdsRef = useRef<Set<string>>(new Set());
  const currentDateRef = useRef<Date>(date || new Date());
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioWarningLoggedRef = useRef(false);
  const fallbackAudioContextRef = useRef<AudioContext | null>(null);

  const playIncomingBookingSound = useCallback(() => {
    if (typeof window === 'undefined') return;

    const playFallbackBeep = () => {
      try {
        const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        if (!fallbackAudioContextRef.current) {
          fallbackAudioContextRef.current = new AudioCtx();
        }
        const context = fallbackAudioContextRef.current;
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(950, context.currentTime);
        gainNode.gain.setValueAtTime(0.0001, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.4);
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.4);
      } catch (beepError) {
        if (!audioWarningLoggedRef.current) {
          console.warn('Fallback booking beep failed:', beepError);
          audioWarningLoggedRef.current = true;
        }
      }
    };

    if (!notificationAudioRef.current) {
      // Served app asset for reliable browser playback.
      // Under the app's base path (/manage/): from the site root it was a 404, so the
      // new-booking alert never played.
      notificationAudioRef.current = new Audio(`${import.meta.env.BASE_URL}sounds/manager-booking-alert.mp3`);
      notificationAudioRef.current.preload = 'auto';
    }

    const audio = notificationAudioRef.current;
    audio.currentTime = 0;
    audio.play().catch((error) => {
      if (!audioWarningLoggedRef.current) {
        console.warn('Booking notification sound could not be played:', error);
      }
      playFallbackBeep();
    });
  }, []);

  const hasLoadedRef = useRef(false);
  const loadAppointments = useCallback(async (targetDate: Date) => {
    if (!businessId) {
      setError(t("common.businessIdIsRequired"));
      setLoading(false);
      return;
    }

    try {
      // Spinner on the first load only. Every day switch used to flip `loading`, which
      // unmounts the whole calendar grid and mounts it again (~250-300 ms frozen on a
      // mid-range phone, SRE 2026-11-15). The grid filters by the date shown, so the
      // previous day's bookings never appear under the new date while this one loads.
      if (!hasLoadedRef.current) setLoading(true);
      setError(null);
      
      const [appointmentsData, staffData] = await Promise.all([
        appointmentService.getAppointmentsByBusiness(businessId, targetDate),
        staffService.getStaffByBusiness(businessId),
      ]);

      // Convert appointments and filter out cancelled ones
      const convertedAppointments = appointmentsData
        // A cancelled service of a multi-service visit stays: the visit is still one visit.
        .filter(apt => apt.status !== 'CANCELLED' || !!apt.visitId)
        .map(apt => {
          const appointmentDate = parse(apt.appointmentDate, 'yyyy-MM-dd', new Date());
          return convertAppointment(apt, appointmentDate);
        });

      // Convert staff
      const convertedStaff = staffData.map(convertStaff);
      seenAppointmentIdsRef.current = new Set(convertedAppointments.map((apt) => apt.apiId).filter((id): id is string => typeof id === 'string'));

      setAppointments(convertedAppointments);
      setStaff(convertedStaff);
      hasLoadedRef.current = true;
      
      console.log(`✅ Loaded ${convertedAppointments.length} appointments for ${format(targetDate, 'yyyy-MM-dd')}`);
    } catch (err) {
      const errorMessage = (err instanceof Error && err.message) || t("hooks.failedToLoadAppointments");
      console.error('Failed to load appointments:', err);
      setError(errorMessage);
      
      // Only show toast if it's a critical error (not just empty results)
      if ((err as { response?: { status?: number } }).response?.status !== 404 && !errorMessage.includes('404')) {
        toast.error(errorMessage);
      }
      
      // Set empty arrays on error to prevent UI crashes
      setAppointments([]);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    const targetDate = date || new Date();
    loadAppointments(targetDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, businessId]); // Only depend on date and businessId to avoid infinite loop

  // WebSocket subscription for real-time updates
  useEffect(() => {
    console.log(`🔌 [useAppointments] WebSocket useEffect triggered - businessId: ${businessId}, date: ${date}`);
    
    if (!businessId) {
      console.warn('⚠️ [useAppointments] No businessId, skipping WebSocket setup');
      return;
    }
    
    let unsubscribe: (() => void) | null = null;
    let isMounted = true;
    const currentDate = date || new Date();
    currentDateRef.current = currentDate;
    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
    console.log(`📅 [useAppointments] Setting up WebSocket for date: ${currentDateStr}`);

    const setupWebSocket = async () => {
      try {
        // Small delay: let the page finish its initial render before opening a
        // WebSocket. Without this, fast navigation or React StrictMode double-invoke
        // causes the cleanup to run while SockJS is mid-handshake →
        // "WebSocket is closed before the connection is established".
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!isMounted) return;

        // This used to poll for window.SockJS / window.Stomp. Those globals came from two
        // <script> tags that #53 removed when it bundled both libraries as imports, so the
        // condition could never become true: the loop spun for two seconds, logged
        // 'WebSocket libraries not loaded', and returned without ever calling connect().
        // The calendar has been showing 'Disconnected' ever since, with a live broker on
        // the other end. websocketService imports them directly; nothing to wait for.
        if (!isMounted) return;
        setWebsocketStatus('connecting');
        await websocketService.connect();

        // Critical: check mount status immediately after the async connect.
        // If the component unmounted during the SockJS handshake, disconnect
        // cleanly and bail — otherwise we'd subscribe to a zombie connection.
        if (!isMounted) {
          websocketService.disconnect();
          return;
        }
        
        setWebsocketStatus('connected');
        console.log(`📡 [useAppointments] Subscribing to appointments for business ${businessId}...`);
        unsubscribe = websocketService.subscribeToAppointments(businessId, (apiAppt: ApiAppointment) => {
          console.log(`📨 [useAppointments] Received appointment update:`, apiAppt);
          if (!isMounted) return;
          
          // Only process appointments for the current date being viewed
          if (apiAppt.appointmentDate !== currentDateStr) {
            return;
          }
          
          // If appointment is cancelled, remove it from the list
          if (apiAppt.status === 'CANCELLED') {
            setAppointments(prev => prev.filter(a => a.apiId !== apiAppt.id));
            return;
          }
          
          const appointmentDate = parse(apiAppt.appointmentDate, 'yyyy-MM-dd', new Date());
          const converted = convertAppointment(apiAppt, appointmentDate);
          const isNewAppointment = typeof apiAppt.id === 'string' && !seenAppointmentIdsRef.current.has(apiAppt.id);
          if (typeof apiAppt.id === 'string') {
            seenAppointmentIdsRef.current.add(apiAppt.id);
          }

          if (isNewAppointment) {
            playIncomingBookingSound();
          }
          
          setAppointments(prev => {
            const existing = prev.findIndex(a => a.apiId === converted.apiId);
            if (existing >= 0) {
              // Update existing
              const updated = [...prev];
              updated[existing] = converted;
              return updated;
            } else {
              // Add new appointment only if it's for the current date
              if (converted.date.toDateString() === currentDateRef.current.toDateString()) {
                return [...prev, converted];
              }
              return prev;
            }
          });
        });
        
        console.log(`✅ [useAppointments] WebSocket subscription set up for business ${businessId} on ${currentDateStr}`);
        setWebsocketStatus('connected');
      } catch (err) {
        console.error('❌ [useAppointments] WebSocket connection failed:', err);
        console.error('Error stack:', (err as Error).stack);
        console.error('Error details:', JSON.stringify(err, null, 2));
        setWebsocketStatus('error');
        // Don't show error toast - WebSocket is optional for real-time updates
        // Appointments will still load via API calls
      }
    };

    console.log('🚀 [useAppointments] Starting WebSocket setup...');
    setupWebSocket();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
      // If cleanup runs while websocketService.connect() is still in flight
      // (e.g. fast navigation, StrictMode), disconnect to close the SockJS socket.
      // This prevents "WebSocket closed before connection established" errors.
      if (websocketService.isConnected() === false) {
        websocketService.disconnect();
      }
    };
  }, [businessId, date, playIncomingBookingSound]); // Include date in dependencies to re-subscribe when date changes

  const createAppointment = useCallback(async (request: {
    staffId: Id;
    serviceId: Id;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    price?: number;
    color?: string;
    notes?: string;
    visitId?: string;
    visitPending?: boolean;
  }, opts?: { silent?: boolean }) => {
    try {
      const apiRequest = {
        businessId,
        staffId: request.staffId,
        serviceId: request.serviceId,
        appointmentDate: request.appointmentDate,
        startTime: request.startTime,
        endTime: request.endTime,
        clientName: request.clientName,
        clientPhone: request.clientPhone,
        clientEmail: request.clientEmail,
        price: request.price,
        color: request.color,
        notes: request.notes,
        ...(request.visitId ? { visitId: request.visitId } : {}),
        ...(request.visitId && request.visitPending ? { visitPending: true } : {}),
      };

      const created = await appointmentService.createAppointment(apiRequest);
      const appointmentDate = parse(created.appointmentDate, 'yyyy-MM-dd', new Date());
      const converted = convertAppointment(created, appointmentDate);

      // The live update for this booking can arrive before this response does; append only
      // if it is not already there, or the calendar shows it twice (duplicate React keys).
      setAppointments(prev => (prev.some(a => a.apiId === converted.apiId) ? prev : [...prev, converted]));
      // In batch/composite bookings (group, recurring, multi-service) the caller
      // shows a single summary toast, so per-item toasts are suppressed here.
      if (!opts?.silent) toast.success(t("hooks.appointmentCreatedSuccessfully"));
      return converted;
    } catch (err) {
      if (!opts?.silent && !(err instanceof BookingConflictDeclined)) toast.error((err instanceof Error && err.message) || t("hooks.failedToCreateAppointment"));
      throw err;
    }
  }, [businessId]);

  const updateAppointment = useCallback(async (id: string, request: {
    staffId: Id;
    serviceId: Id;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    clientId?: Id;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    price?: number;
    color?: string;
    notes?: string;
  }) => {
    try {
      const apiRequest = { businessId, ...request };
      const updated = await appointmentService.updateAppointment(id, apiRequest);
      const appointmentDate = parse(updated.appointmentDate, 'yyyy-MM-dd', new Date());
      const converted = convertAppointment(updated, appointmentDate);
      setAppointments(prev => prev.map(apt => apt.apiId === id ? converted : apt));
      toast.success(t("hooks.appointmentUpdatedSuccessfully"));
      return converted;
    } catch (err) {
      if (!(err instanceof BookingConflictDeclined)) toast.error((err instanceof Error && err.message) || t("hooks.failedToUpdateAppointment"));
      throw err;
    }
  }, [businessId]);

  const deleteAppointment = useCallback(async (id: string) => {
    try {
      await appointmentService.deleteAppointment(id);
      setAppointments(prev => prev.filter(apt => apt.apiId !== id));
      toast.success(t("hooks.appointmentCancelledSuccessfully"));
    } catch (err) {
      toast.error((err instanceof Error && err.message) || t("hooks.failedToDeleteAppointment"));
      throw err;
    }
  }, []);

  return {
    appointments,
    staff,
    loading,
    error,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    refresh: () => loadAppointments(date || new Date()),
    websocketStatus,
  };
}




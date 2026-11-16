import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

/** R02: clients booqi brought (marketplace) vs the salon's own clients booking online (link, QR). */
export interface ClientSourceCounts {
  booqiClients: number;
  ownOnlineClients: number;
}
export interface ClientSources {
  last30Days: ClientSourceCounts;
  allTime: ClientSourceCounts;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  bookings: number;
}

export interface TopService {
  serviceId: Id;
  serviceName: string;
  bookings: number;
  revenue: number;
  growth: number;
}

export interface TopStaff {
  staffId: Id;
  staffName: string;
  bookings: number;
  revenue: number;
  growth: number;
  averageTicket: number;
}

export interface RevenueByCategory {
  categoryName: string;
  revenue: number;
  bookings: number;
  percentage: number;
}

export interface ClientGrowth {
  totalClients: number;
  newClientsThisPeriod: number;
  returningClients: number;
  growthData: Array<{
    period: string;
    newClients: number;
    totalClients: number;
  }>;
}

export interface BookingTrends {
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  cancellationRate: number;
  noShowRate: number;
  trendData: Array<{
    period: string;
    bookings: number;
    confirmed: number;
    cancelled: number;
  }>;
  bookingsByStatus: Record<string, number>;
  bookingsByDayOfWeek: Record<string, number>;
}

export interface StaffPerformance {
  staffDetails: Array<{
    staffId: Id;
    staffName: string;
    bookings: number;
    revenue: number;
    averageTicket: number;
    utilizationRate: number;
    hoursWorked: number;
  }>;
  totalStaffRevenue: number;
  totalStaffBookings: number;
  averageRevenuePerStaff: number;
}

export interface AnalyticsOverview {
  totalRevenue: number;
  revenueChange: number;
  totalBookings: number;
  bookingsChange: number;
  newClients: number;
  newClientsChange: number;
  averageTicket: number;
  averageTicketChange: number;
  dailyRevenue: DailyRevenue[];
  topServices: TopService[];
  topStaff: TopStaff[];
  revenueByCategory: RevenueByCategory[];
  clientGrowth: ClientGrowth;
  bookingTrends: BookingTrends;
  staffPerformance: StaffPerformance;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  averageDailyRevenue: number;
  peakDayRevenue: number;
  lowestDayRevenue: number;
  revenueByDay: Array<{ date: string; revenue: number; bookings: number }>;
  revenueByHour: Array<{ hour: number; revenue: number; bookings: number }>;
  revenueByPaymentMethod: Array<{ paymentMethod: string; revenue: number; transactions: number; percentage: number }>;
  revenueByDayOfWeek: Record<string, number>;
  revenueGrowthRate: number;
  revenueForecast: Array<{ period: string; forecastedRevenue: number; confidenceLevel: number }>;
}

export interface BookingAnalytics {
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  cancellationRate: number;
  noShowRate: number;
  confirmationRate: number;
  bookingsByDayOfWeek: Array<{ dayOfWeek: string; bookings: number; percentage: number }>;
  bookingsByHour: Array<{ hour: number; bookings: number; percentage: number }>;
  bookingTrends: Array<{ period: string; bookings: number; confirmed: number; cancelled: number; noShow: number }>;
  bookingsByStatus: Record<string, number>;
  averageBookingsPerDay: number;
  peakDayBookings: number;
  cancellationReasons: Array<{ reason: string; count: number; percentage: number }>;
}

export interface ClientAnalytics {
  totalClients: number;
  newClients: number;
  returningClients: number;
  retentionRate: number;
  newClientRate: number;
  clientGrowth: Array<{ period: string; newClients: number; totalClients: number }>;
  topClients: Array<{ clientId: Id; clientName: string; totalBookings: number; totalSpent: number; lastVisitDaysAgo: number; averageTicket: number }>;
  averageClientValue: number;
  averageVisitsPerClient: number;
  clientSegments: Array<{ segment: string; count: number; totalRevenue: number; percentage: number }>;
  activeClients: number;
  inactiveClients: number;
}

export interface ServiceAnalytics {
  servicePerformance: Array<{ serviceId: Id; serviceName: string; categoryName: string; bookings: number; revenue: number; averagePrice: number; averageDuration: number; popularityScore: number; revenuePercentage: number }>;
  categoryPerformance: Array<{ categoryName: string; totalBookings: number; totalRevenue: number; serviceCount: number; averageServicePrice: number; revenuePercentage: number }>;
  averageServicePrice: number;
  mostPopularServiceId: Id;
  mostPopularServiceName: string;
  highestRevenueServiceId: Id;
  highestRevenueServiceName: string;
  serviceTrends: Array<{ serviceId: Id; serviceName: string; period: string; bookings: number; revenue: number; growth: number }>;
  servicesByCategory: Record<string, number>;
}

export interface StaffDetail {
  staffId: Id;
  staffName: string;
  bookings: number;
  completed: number;
  noShow: number;
  revenue: number;
  completionRate: number;
}

export interface PerformanceAnalytics {
  staffDetails: StaffDetail[];
  totalStaffRevenue: number;
  totalStaffBookings: number;
  averageRevenuePerStaff: number;
}

export interface CancellationByDay {
  date: string;
  cancellations: number;
}

export interface CancellationAnalytics {
  cancellationsByDay: CancellationByDay[];
  totalCancellations: number;
}

export interface PeakHour {
  hour: number;
  bookings: number;
}

export interface PeakHoursAnalytics {
  peakHours: PeakHour[];
}

export interface CustomerRetentionAnalytics {
  totalClients: number;
  returningClients: number;
  retentionRate: number;
}

export interface ProfitabilityAnalytics {
  totalRevenue: number;
  estimatedProfit: number;
  profitMargin: number;
}

export interface PaymentMethod {
  method: string;
  transactions: number;
  revenue: number;
  percentage: number;
}

export interface PaymentMethodsAnalytics {
  paymentMethods: PaymentMethod[];
  totalRevenue: number;
}


/** What the salon's offers cost it, and what they brought in. */
export interface DiscountImpact {
  totals: {
    discounted_bookings: number;
    bookings: number;
    given_away: number;
    discounted_revenue: number;
    revenue: number;
  } | null;
  byMonth: { month: string; discounted_bookings: number; given_away: number; revenue: number }[];
  byService: {
    service: string;
    bookings: number;
    given_away: number;
    revenue: number;
    average_percent: number | null;
  }[];
  /** First visits in the period, and how many of them arrived on an offer. */
  newClients: { on_offer: number; all_first_visits: number } | null;
}


/** What empty chairs cost, and what the policy recorded for them. */
export interface NoShowImpact {
  totals: {
    no_shows: number;
    cancellations: number;
    bookings: number;
    lost_revenue: number;
    fees_recorded: number;
    fees_count: number;
  } | null;
  byMonth: { month: string; no_shows: number; cancellations: number; fees_recorded: number }[];
  repeatOffenders: {
    client: string;
    client_email: string | null;
    no_shows: number;
    cancellations: number;
    fees_recorded: number;
    latest: string;
  }[];
  recent: Record<string, unknown>[];
  /** A window of 0 means the salon has set no policy, so nothing is ever charged. */
  policy: { window_hours: number; late_fee: number } | null;
}

export const analysisService = {
  async getNoShowImpact(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<NoShowImpact> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    return apiClient.get<NoShowImpact>(
      `/analytics/business/${businessId}/no-shows${queryString ? `?${queryString}` : ''}`
    );
  },

  async getDiscountImpact(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<DiscountImpact> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    return apiClient.get<DiscountImpact>(
      `/analytics/business/${businessId}/discounts${queryString ? `?${queryString}` : ''}`
    );
  },

  async getAnalyticsOverview(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsOverview> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/overview${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get<AnalyticsOverview>(url);
  },

  getClientSources(businessId: Id): Promise<ClientSources> {
    return apiClient.get<ClientSources>(`/analytics/business/${businessId}/client-sources`);
  },
  
  async getRevenueAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<RevenueAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/revenue${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get<RevenueAnalytics>(url);
  },
  
  async getBookingAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<BookingAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/bookings${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get<BookingAnalytics>(url);
  },
  
  async getClientAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<ClientAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/clients${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get<ClientAnalytics>(url);
  },
  
  async getServiceAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<ServiceAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/services${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get<ServiceAnalytics>(url);
  },
  
  async getPerformanceAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<PerformanceAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/performance${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PerformanceAnalytics>(url);
  },
  
  async getCancellationAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<CancellationAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/cancellations${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<CancellationAnalytics>(url);
  },
  
  async getPeakHoursAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<PeakHoursAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/peak-hours${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PeakHoursAnalytics>(url);
  },
  
  async getCustomerRetentionAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<CustomerRetentionAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/customer-retention${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<CustomerRetentionAnalytics>(url);
  },
  
  async getProfitabilityAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<ProfitabilityAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/profitability${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<ProfitabilityAnalytics>(url);
  },
  
  async getPaymentMethodAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ): Promise<PaymentMethodsAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/payment-methods${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PaymentMethodsAnalytics>(url);
  },
  
  async getSeasonalAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/seasonal${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get(url);
  },
  
  async getServiceDurationAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/service-duration${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get(url);
  },
  
  async getWaitTimeAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/wait-times${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get(url);
  },
  
  async getBookingLeadTimeAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/booking-lead-time${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get(url);
  },
  
  async getRevenuePerHourAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/revenue-per-hour${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get(url);
  },
  
  async getCustomerAcquisitionAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/customer-acquisition${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get(url);
  },
  
  async getServiceBundleAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/service-bundles${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get(url);
  },
  
  async getGrowthForecastAnalytics(
    businessId: Id,
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = `/analytics/business/${businessId}/growth-forecast${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.get(url);
  },
};


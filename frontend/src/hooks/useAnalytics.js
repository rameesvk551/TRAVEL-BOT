// FILE: /frontend/src/hooks/useAnalytics.js

import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analyticsApi';

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsApi.getSummary(),
    staleTime: 60 * 1000,
  });
}

export function useSalesReport(params) {
  return useQuery({
    queryKey: ['analytics-sales', params],
    queryFn: () => analyticsApi.getSales(params),
    staleTime: 60 * 1000,
  });
}

export function useLeadFunnelReport(params) {
  return useQuery({
    queryKey: ['analytics-lead-funnel', params],
    queryFn: () => analyticsApi.getLeadFunnel(params),
    staleTime: 60 * 1000,
  });
}

export function useAgentPerformanceReport(params) {
  return useQuery({
    queryKey: ['analytics-agent-performance', params],
    queryFn: () => analyticsApi.getAgentPerformance(params),
    staleTime: 60 * 1000,
  });
}

export function usePackageReport(params) {
  return useQuery({
    queryKey: ['analytics-packages', params],
    queryFn: () => analyticsApi.getPackages(params),
    staleTime: 60 * 1000,
  });
}

export function useLostLeadsReport(params) {
  return useQuery({
    queryKey: ['analytics-lost-leads', params],
    queryFn: () => analyticsApi.getLostLeads(params),
    staleTime: 60 * 1000,
  });
}

export function useResponseReport(params) {
  return useQuery({
    queryKey: ['analytics-response', params],
    queryFn: () => analyticsApi.getResponse(params),
    staleTime: 60 * 1000,
  });
}

export function useReviewReport(params) {
  return useQuery({
    queryKey: ['analytics-reviews', params],
    queryFn: () => analyticsApi.getReviews(params),
    staleTime: 60 * 1000,
  });
}

export function useSeasonalReport() {
  return useQuery({
    queryKey: ['analytics-seasonal'],
    queryFn: () => analyticsApi.getSeasonal(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProfitReport(params) {
  return useQuery({
    queryKey: ['analytics-profit', params],
    queryFn: () => analyticsApi.getProfit(params),
    staleTime: 60 * 1000,
  });
}

export function useSourceReport(params) {
  return useQuery({
    queryKey: ['analytics-sources', params],
    queryFn: () => analyticsApi.getSources(params),
    staleTime: 60 * 1000,
  });
}

export function useBookingReport(params) {
  return useQuery({
    queryKey: ['analytics-bookings', params],
    queryFn: () => analyticsApi.getBookings(params),
    staleTime: 60 * 1000,
  });
}

export function useCustomerLtvReport(params) {
  return useQuery({
    queryKey: ['analytics-customer-ltv', params],
    queryFn: () => analyticsApi.getCustomerLtv(params),
    staleTime: 60 * 1000,
  });
}

export function useCacReport(params) {
  return useQuery({
    queryKey: ['analytics-cac', params],
    queryFn: () => analyticsApi.getCac(params),
    staleTime: 60 * 1000,
  });
}

export function useOperationalReport(params) {
  return useQuery({
    queryKey: ['analytics-operational', params],
    queryFn: () => analyticsApi.getOperational(params),
    staleTime: 60 * 1000,
  });
}

export function useCampaignRoiReport(params) {
  return useQuery({
    queryKey: ['analytics-campaign-roi', params],
    queryFn: () => analyticsApi.getCampaignRoi(params),
    staleTime: 60 * 1000,
  });
}

export function useGrowthReport(params) {
  return useQuery({
    queryKey: ['analytics-growth', params],
    queryFn: () => analyticsApi.getGrowth(params),
    staleTime: 60 * 1000,
  });
}

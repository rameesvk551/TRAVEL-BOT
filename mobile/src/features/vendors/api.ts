// FILE: mobile/src/features/vendors/api.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface Vendor {
  id: string;
  name: string;
  category: string; // Hotel, Flight, Activity
  balanceDue: number;
  contactName: string;
}

export interface VendorPayment {
  id: string;
  vendorName: string;
  amount: number;
  status: string; // Pending, Paid
  date: string;
}

export function useVendors(category?: string) {
  return useQuery({
    queryKey: ['vendors', category],
    queryFn: async () => {
      try {
        const response = await api.get('/vendors', { params: { category } });
        return response.data.data as Vendor[];
      } catch (err: any) {
        return getMockVendors().filter(v => {
          if (!category || category === 'All') return true;
          return v.category === category;
        });
      }
    },
  });
}

export function useVendorPayments(status?: string) {
  return useQuery({
    queryKey: ['vendorPayments', status],
    queryFn: async () => {
      try {
        const response = await api.get('/vendor-payments', { params: { status } });
        return response.data.data as VendorPayment[];
      } catch (err: any) {
        return getMockVendorPayments().filter(vp => {
          if (!status || status === 'All') return true;
          return vp.status === status;
        });
      }
    },
  });
}

function getMockVendors(): Vendor[] {
  return [
    { id: '1', name: 'Taj Hotels', category: 'Hotel', balanceDue: 450000, contactName: 'Rajesh' },
    { id: '2', name: 'Indigo Airlines', category: 'Flight', balanceDue: 0, contactName: 'Support' },
    { id: '3', name: 'Goa Watersports Co.', category: 'Activity', balanceDue: 15000, contactName: 'Vikram' },
  ];
}

function getMockVendorPayments(): VendorPayment[] {
  return [
    { id: '1', vendorName: 'Taj Hotels', amount: 150000, status: 'Pending', date: new Date().toISOString() },
    { id: '2', vendorName: 'Goa Watersports Co.', amount: 15000, status: 'Paid', date: new Date(Date.now() - 86400000 * 2).toISOString() },
  ];
}

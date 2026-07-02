import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../api/client';
import toast from 'react-hot-toast';

export default function SettingsCompanyProfile() {
  const { agency, updateAgency } = useAuthStore();
  const [logo, setLogo] = useState(agency?.companyLogoUrl);
  const [seal, setSeal] = useState(agency?.companySealUrl);
  const [signature, setSignature] = useState(agency?.authorizedSignatureUrl);
  const [taxForm, setTaxForm] = useState({
    gstin: agency?.gstin || '',
    upiId: agency?.upiId || '',
    stateCode: agency?.stateCode || '',
    defaultSalesRate: String((agency?.accountingSettings?.gst?.defaultSalesRateBps ?? 0) / 100),
    taxInclusive: agency?.accountingSettings?.gst?.taxInclusive !== false,
  });
  const [uploading, setUploading] = useState({ logo: false, seal: false, signature: false });
  const [savingTax, setSavingTax] = useState(false);

  const handleUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setUploading((prev) => ({ ...prev, [type]: true }));
    try {
      const res = await api.post(`/agencies/me/upload-${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`);
        if (type === 'logo') setLogo(res.data.data.url);
        if (type === 'seal') setSeal(res.data.data.url);
        if (type === 'signature') setSignature(res.data.data.url);
      } else {
        toast.error(res.data.error || 'Upload failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleTaxSave = async (event) => {
    event.preventDefault();
    setSavingTax(true);
    try {
      const rate = Number(taxForm.defaultSalesRate || 0);
      const res = await api.patch('/agencies/me', {
        gstin: taxForm.gstin.trim() || null,
        upiId: taxForm.upiId.trim() || null,
        stateCode: taxForm.stateCode.trim() || null,
        accountingSettings: {
          ...(agency?.accountingSettings || {}),
          gst: {
            ...(agency?.accountingSettings?.gst || {}),
            defaultSalesRateBps: Math.round(rate * 100),
            taxInclusive: taxForm.taxInclusive,
            defaultTreatment: agency?.accountingSettings?.gst?.defaultTreatment || 'UNREGISTERED',
          },
        },
      });
      updateAgency(res.data.data);
      toast.success('GST settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save GST settings');
    } finally {
      setSavingTax(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Company Profile</h2>
            <p className="text-sm text-neutral-500">Manage your company assets like logos and signatures.</p>
          </div>
        </div>
        <div className="p-6 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Logo Upload */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700">Company Logo</label>
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-lg p-6 bg-neutral-50 relative group">
                {logo ? (
                  <img src={logo} alt="Logo" className="max-h-24 object-contain" />
                ) : (
                  <div className="text-neutral-400 text-sm">No logo uploaded</div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => handleUpload(e, 'logo')} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  disabled={uploading.logo}
                />
                <div className="mt-4 text-xs font-medium text-blue-600 group-hover:text-blue-800 transition-colors">
                  {uploading.logo ? 'Uploading...' : 'Click to upload'}
                </div>
              </div>
              <p className="text-xs text-neutral-500">Recommended: Transparent PNG, max 5MB.</p>
            </div>

            {/* Seal Upload */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700">Company Seal</label>
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-lg p-6 bg-neutral-50 relative group">
                {seal ? (
                  <img src={seal} alt="Seal" className="max-h-24 object-contain" />
                ) : (
                  <div className="text-neutral-400 text-sm">No seal uploaded</div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => handleUpload(e, 'seal')} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  disabled={uploading.seal}
                />
                <div className="mt-4 text-xs font-medium text-blue-600 group-hover:text-blue-800 transition-colors">
                  {uploading.seal ? 'Uploading...' : 'Click to upload'}
                </div>
              </div>
              <p className="text-xs text-neutral-500">Appears on invoices and official documents.</p>
            </div>

            {/* Signature Upload */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700">Authorized Signature</label>
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-lg p-6 bg-neutral-50 relative group">
                {signature ? (
                  <img src={signature} alt="Signature" className="max-h-24 object-contain" />
                ) : (
                  <div className="text-neutral-400 text-sm">No signature uploaded</div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => handleUpload(e, 'signature')} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  disabled={uploading.signature}
                />
                <div className="mt-4 text-xs font-medium text-blue-600 group-hover:text-blue-800 transition-colors">
                  {uploading.signature ? 'Uploading...' : 'Click to upload'}
                </div>
              </div>
              <p className="text-xs text-neutral-500">Appears at the bottom of invoices.</p>
            </div>

          </div>

        </div>
      </div>

      <form onSubmit={handleTaxSave} className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">India GST Settings</h2>
          <p className="text-sm text-neutral-500">Used for booking invoices, GST ledgers, and credit-note tax reversal.</p>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="block">
              <span className="block text-sm font-medium text-neutral-700">Company GSTIN</span>
              <input
                value={taxForm.gstin}
                onChange={(e) => setTaxForm({ ...taxForm, gstin: e.target.value.toUpperCase() })}
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="32ABCDE1234F1Z5"
                maxLength={15}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-neutral-700">GST State Code</span>
              <input
                value={taxForm.stateCode}
                onChange={(e) => setTaxForm({ ...taxForm, stateCode: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="32"
                maxLength={2}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-neutral-700">Default booking GST %</span>
              <input
                value={taxForm.defaultSalesRate}
                onChange={(e) => setTaxForm({ ...taxForm, defaultSalesRate: e.target.value })}
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                inputMode="decimal"
                placeholder="5"
              />
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700">
              <input
                type="checkbox"
                checked={taxForm.taxInclusive}
                onChange={(e) => setTaxForm({ ...taxForm, taxInclusive: e.target.checked })}
              />
              Booking amount includes GST
            </label>
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-neutral-700">UPI ID for invoice payments</span>
              <input
                value={taxForm.upiId}
                onChange={(e) => setTaxForm({ ...taxForm, upiId: e.target.value.trim() })}
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="yourbusiness@okhdfcbank"
                maxLength={120}
              />
              <span className="mt-1 block text-xs text-neutral-500">
                Adds a "Scan to pay balance" QR to invoices. Customers scan it with Google Pay / PhonePe / Paytm and the balance amount is filled in automatically.
              </span>
            </label>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingTax} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {savingTax ? 'Saving...' : 'Save GST Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

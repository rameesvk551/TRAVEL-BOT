import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon, ArrowLeftIcon, EyeIcon } from '@heroicons/react/24/outline';
import Handlebars from 'handlebars';
import { useAuthStore } from '../store/authStore';

const emptyItem = { name: '', description: '', quantity: 1, price: 0, amount: 0 };

const listFromResponse = (response) => {
  const data = response?.data?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
};

export default function QuotationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const agency = useAuthStore(s => s.agency);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'preview'
  const iframeRef = useRef(null);

  const [formData, setFormData] = useState({
    leadId: '',
    customerId: '',
    templateId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'DRAFT',
    items: [{ ...emptyItem }],
    amountInWords: ''
  });

  useEffect(() => {
    fetchDependencies();
    if (isEditing) {
      fetchQuotation();
    }
  }, [id]);

  const fetchDependencies = async () => {
    try {
      const [leadsRes, tplRes] = await Promise.all([
        api.get('/leads?limit=100'),
        api.get('/quotation-templates')
      ]);
      const nextLeads = listFromResponse(leadsRes);
      const nextTemplates = listFromResponse(tplRes);

      setLeads(nextLeads);
      setTemplates(nextTemplates);
      
      // Auto-select default template if creating new
      if (!isEditing && nextTemplates.length > 0) {
        const defTpl = nextTemplates.find(t => t.isDefault) || nextTemplates[0];
        setFormData(prev => ({ ...prev, templateId: defTpl.id }));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load quotation data');
    }
  };

  const fetchQuotation = async () => {
    try {
      const res = await api.get(`/quotations/${id}`);
      const q = res.data.data;
      setFormData({
        leadId: q.leadId || '',
        customerId: q.customerId || '',
        templateId: q.templateId || '',
        date: q.date || '',
        status: q.status || 'DRAFT',
        items: Array.isArray(q.items) && q.items.length > 0 ? q.items : [{ ...emptyItem }],
        amountInWords: q.amountInWords || ''
      });
    } catch (err) {
      toast.error('Failed to load quotation');
      navigate('/quotations');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (itemsList) => {
    return (Array.isArray(itemsList) ? itemsList : []).reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = Array.isArray(formData.items) ? [...formData.items] : [{ ...emptyItem }];
    newItems[index][field] = value;
    
    if (field === 'quantity' || field === 'price') {
      const qty = Number(newItems[index].quantity) || 0;
      const price = Number(newItems[index].price) || 0;
      newItems[index].amount = qty * price;
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...(Array.isArray(formData.items) ? formData.items : []), { ...emptyItem }]
    });
  };

  const removeItem = (index) => {
    const currentItems = Array.isArray(formData.items) ? formData.items : [];
    const newItems = currentItems.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems.length > 0 ? newItems : [{ ...emptyItem }] });
  };

  const handleSave = async () => {
    if (!formData.templateId) return toast.error('Please select a template');
    
    setSaving(true);
    try {
      const total = calculateTotals(formData.items);
      const payload = {
        ...formData,
        subTotal: total,
        totalAmount: total,
      };

      if (isEditing) {
        await api.put(`/quotations/${id}`, payload);
        toast.success('Quotation updated');
      } else {
        await api.post('/quotations', payload);
        toast.success('Quotation created');
        navigate('/quotations');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = () => {
    const template = templates.find(t => t.id === formData.templateId);
    if (!template) return '<div style="padding:20px; text-align:center;">Please select a template to preview.</div>';

    const lead = leads.find(l => l.id === formData.leadId);
    
    try {
      Handlebars.registerHelper('formatAmount', function(amount) {
        return Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      });
      const tpl = Handlebars.compile(template.htmlContent);
      
      const total = calculateTotals(formData.items);
      
      return tpl({
        config: template.config || {},
        agency: agency || {},
        customer: {
          name: lead?.name || lead?.customer?.name || 'Customer Name',
          phone: lead?.phone || lead?.customer?.phone || 'Contact Number'
        },
        quotation: {
          estimateNumber: isEditing ? id.split('-')[0] : 'NEW',
          date: formData.date,
          items: Array.isArray(formData.items) ? formData.items : [],
          subTotal: total,
          totalAmount: total,
          amountInWords: formData.amountInWords || 'Zero'
        }
      });
    } catch (err) {
      return `<div style="color:red; padding:20px;">Handlebars Error: ${err.message}</div>`;
    }
  };

  useEffect(() => {
    if (activeTab === 'preview' && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(renderPreview());
        doc.close();
      }
    }
  }, [activeTab, formData, templates, leads]);

  if (loading) return <div>Loading...</div>;

  const totalAmount = calculateTotals(formData.items);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/quotations')} className="text-neutral-500 hover:bg-neutral-100 p-2 rounded-full">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">{isEditing ? 'Edit Quotation' : 'New Quotation'}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-neutral-100 p-1 rounded-lg flex text-sm font-medium">
            <button 
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-1.5 rounded-md transition-colors ${activeTab === 'editor' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              Builder
            </button>
            <button 
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-colors ${activeTab === 'preview' ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              <EyeIcon className="w-4 h-4" /> Preview
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-all active:scale-95"
          >
            {saving ? 'Saving...' : 'Save Quotation'}
          </button>
        </div>
      </div>

      <div className={activeTab === 'editor' ? 'block' : 'hidden'}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5 space-y-4">
              <h3 className="font-semibold text-neutral-900">Quotation Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Select Lead</label>
                <select
                  value={formData.leadId}
                  onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Select a Lead --</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name} - {l.phone}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Quotation Template</label>
                <select
                  value={formData.templateId}
                  onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50/30"
                >
                  <option value="">-- Select Template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5 space-y-4">
              <h3 className="font-semibold text-neutral-900">Amount In Words</h3>
              <textarea
                value={formData.amountInWords}
                onChange={(e) => setFormData({ ...formData, amountInWords: e.target.value })}
                placeholder="e.g. Forty Thousand Rupees Only"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                rows={3}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
              <div className="p-5 border-b border-neutral-200 flex justify-between items-center bg-neutral-50/50">
                <h3 className="font-semibold text-neutral-900">Particulars (Line Items)</h3>
                <button
                  onClick={addItem}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-white border border-neutral-200 px-3 py-1.5 rounded-md shadow-sm"
                >
                  <PlusIcon className="w-4 h-4" /> Add Item
                </button>
              </div>
              <div className="p-0">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-100 text-neutral-600 border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-3 font-medium">Description</th>
                      <th className="px-4 py-3 font-medium w-24">Qty</th>
                      <th className="px-4 py-3 font-medium w-32">Price/Unit</th>
                      <th className="px-4 py-3 font-medium w-32 text-right">Amount</th>
                      <th className="px-4 py-3 font-medium w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {(Array.isArray(formData.items) ? formData.items : []).map((item, index) => (
                      <tr key={index} className="group hover:bg-neutral-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                            placeholder="Item name (e.g. Couple Package)"
                            className="w-full border border-neutral-200 rounded-md px-2 py-1.5 focus:border-blue-500 outline-none bg-white shadow-sm mb-2"
                          />
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            placeholder="Additional details (optional)"
                            className="w-full border border-transparent hover:border-neutral-200 rounded-md px-2 py-1 focus:border-blue-500 outline-none bg-transparent text-xs text-neutral-500"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="w-full border border-neutral-200 rounded-md px-2 py-1.5 focus:border-blue-500 outline-none text-center shadow-sm"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <input
                            type="number"
                            min="0"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                            className="w-full border border-neutral-200 rounded-md px-2 py-1.5 focus:border-blue-500 outline-none text-right shadow-sm"
                          />
                        </td>
                        <td className="px-4 py-3 align-top text-right font-medium text-neutral-900 pt-5">
                          ₹{Number(item.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 align-top text-center pt-5">
                          <button
                            onClick={() => removeItem(index)}
                            className="text-neutral-400 hover:text-red-500 transition-colors"
                            title="Remove item"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-neutral-50 p-6 border-t border-neutral-200 flex justify-end">
                <div className="w-64">
                  <div className="flex justify-between items-center py-2 border-b border-neutral-200 text-sm">
                    <span className="text-neutral-600">Sub Total</span>
                    <span className="font-medium">₹{totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 text-lg font-bold text-neutral-900">
                    <span>Total</span>
                    <span>₹{totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={activeTab === 'preview' ? 'block' : 'hidden'}>
        <div className="bg-neutral-200 p-8 rounded-xl flex justify-center min-h-[800px]">
          <div className="bg-white shadow-xl w-full max-w-[850px] min-h-[1100px] relative border border-neutral-300">
            <iframe
              ref={iframeRef}
              className="w-full h-full absolute inset-0 border-0"
              title="Quotation Preview"
            />
          </div>
        </div>
      </div>

    </div>
  );
}

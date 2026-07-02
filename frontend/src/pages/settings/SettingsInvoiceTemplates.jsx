import React from 'react';
import DocumentTemplateBuilder from '../../components/DocumentTemplateBuilder';

export default function SettingsInvoiceTemplates() {
  return <DocumentTemplateBuilder docType="invoice" apiBase="/invoice-templates" title="Invoice Templates" />;
}

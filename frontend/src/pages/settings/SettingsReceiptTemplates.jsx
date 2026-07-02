import React from 'react';
import DocumentTemplateBuilder from '../../components/DocumentTemplateBuilder';

export default function SettingsReceiptTemplates() {
  return <DocumentTemplateBuilder docType="receipt" apiBase="/receipt-templates" title="Receipt Templates" />;
}

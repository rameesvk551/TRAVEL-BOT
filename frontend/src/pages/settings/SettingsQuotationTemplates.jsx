import React from 'react';
import DocumentTemplateBuilder from '../../components/DocumentTemplateBuilder';

export default function SettingsQuotationTemplates() {
  return <DocumentTemplateBuilder docType="quotation" apiBase="/quotation-templates" title="Quotation Templates" />;
}

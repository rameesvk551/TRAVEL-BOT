import React from 'react';
import DocumentTemplateBuilder from '../../components/DocumentTemplateBuilder';

export default function SettingsItineraryTemplates() {
  return <DocumentTemplateBuilder docType="itinerary" apiBase="/itinerary-templates" title="Itinerary Templates" />;
}

// FILE: /frontend/src/components/PaymentBadge.jsx

import { getStatusBadgeClass } from '../utils/formatters';

export default function PaymentBadge({ status }) {
  return <span className={`badge ${getStatusBadgeClass(status)}`}>{status}</span>;
}

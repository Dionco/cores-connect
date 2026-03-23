import React from 'react';

type BadgeStatus = 'Active' | 'Inactive' | 'Onboarding' | 'Provisioned' | 'Pending' | 'Failed' | 'Completed' | 'Running' | 'Queued';

const statusStyles: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-gray-100 text-gray-600',
  Onboarding: 'bg-amber-100 text-amber-700',
  Provisioned: 'bg-emerald-100 text-emerald-700',
  Pending: 'bg-amber-100 text-amber-700',
  Failed: 'bg-red-100 text-red-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Running: 'bg-blue-100 text-blue-700 animate-pulse',
  Queued: 'bg-gray-100 text-gray-600',
};

const StatusBadge = ({ status }: { status: BadgeStatus }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status] || 'bg-gray-100 text-gray-600'}`}>
    {status}
  </span>
);

export default StatusBadge;

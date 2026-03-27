import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { mockEmployees, mockProvisioningJobs, mockLeaveRequests, mockLeaveBalances } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Users, ClipboardCheck, Zap, UserPlus, CalendarDays, ArrowRight } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
const Dashboard = () => {
  const { t } = useLanguage();

  const totalEmployees = mockEmployees.filter(e => e.status !== 'Inactive').length;
  const activeOnboardings = mockEmployees.filter(e => e.status === 'Onboarding').length;
  const pendingProvisioning = mockProvisioningJobs.filter(j => j.status === 'Queued' || j.status === 'Running').length;
  const recentlyAdded = mockEmployees.filter(e => {
    const d = new Date(e.startDate);
    const now = new Date('2026-03-23');
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 30;
  }).length;

  const recentEmployees = [...mockEmployees]
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 5);

  const onboardingEmployees = mockEmployees.filter(e => e.status === 'Onboarding');

  const stats = [
    { label: t('dashboard.totalEmployees'), value: totalEmployees, icon: Users, color: 'text-cores-teal' },
    { label: t('dashboard.activeOnboardings'), value: activeOnboardings, icon: ClipboardCheck, color: 'text-cores-orange' },
    { label: t('dashboard.pendingProvisioning'), value: pendingProvisioning, icon: Zap, color: 'text-cores-yellow' },
    { label: t('dashboard.recentlyAdded'), value: recentlyAdded, icon: UserPlus, color: 'text-cores-green', sub: t('dashboard.last30days') },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-xl bg-muted p-3 ${stat.color}`}>
                <stat.icon size={22} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                {stat.sub && <p className="text-[10px] text-muted-foreground">{stat.sub}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent employees */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-base font-semibold text-foreground">{t('dashboard.recentEmployees')}</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('employees.name')}</TableHead>
                <TableHead>{t('employees.department')}</TableHead>
                <TableHead>{t('employees.startDate')}</TableHead>
                <TableHead>{t('employees.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentEmployees.map((emp) => (
                <TableRow key={emp.id} className="cursor-pointer">
                  <TableCell className="font-medium">{emp.firstName} {emp.lastName}</TableCell>
                  <TableCell>{emp.department}</TableCell>
                  <TableCell>{emp.startDate}</TableCell>
                  <TableCell><StatusBadge status={emp.provisioningStatus} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Onboarding progress */}
      {onboardingEmployees.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <h2 className="text-base font-semibold text-foreground">{t('dashboard.onboardingProgress')}</h2>
            {onboardingEmployees.map((emp) => {
              const completed = emp.onboardingTasks.filter(t => t.completed).length;
              const total = emp.onboardingTasks.length;
              const pct = Math.round((completed / total) * 100);
              return (
                <div key={emp.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;

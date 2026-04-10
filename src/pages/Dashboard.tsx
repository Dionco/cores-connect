import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { mockProvisioningJobs, mockLeaveRequests, mockLeaveBalances } from '@/data/mockData';
import { useEmployees } from '@/hooks/useEmployees';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Users, ClipboardCheck, Zap, UserPlus, CalendarDays, ArrowRight } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
const Dashboard = () => {
  const { t } = useLanguage();
  const { employees } = useEmployees();

  const totalEmployees = employees.filter(e => e.status !== 'Inactive').length;
  const activeOnboardings = employees.filter(e => e.status === 'Onboarding').length;
  const pendingProvisioning = mockProvisioningJobs.filter(j => j.status === 'Queued' || j.status === 'Running').length;
  const recentlyAdded = employees.filter(e => {
    const d = new Date(e.startDate);
    const now = new Date('2026-03-23');
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 30;
  }).length;

  const recentEmployees = [...employees]
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 5);

  const onboardingEmployees = employees.filter(e => e.status === 'Onboarding');

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

      {/* Absence widget */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-cores-teal" />
              <h2 className="text-base font-semibold text-foreground">{t('dashboard.absence')}</h2>
            </div>
            <Link to="/absence" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {t('dashboard.viewAll')} <ArrowRight size={14} />
            </Link>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {(() => {
              const pending = mockLeaveRequests.filter(r => r.status === 'Pending').length;
              const approved = mockLeaveRequests.filter(r => r.status === 'Approved').length;
              const totalOut = mockLeaveBalances.reduce((sum, b) => sum + b.usedDays, 0);
              const summaryItems = [
                { label: t('absence.pendingRequests'), value: pending, accent: 'bg-cores-orange/15 text-cores-orange' },
                { label: t('absence.approved'), value: approved, accent: 'bg-cores-teal/15 text-cores-teal' },
                { label: t('absence.totalDaysTaken'), value: totalOut, accent: 'bg-muted text-muted-foreground' },
              ];
              return summaryItems.map(s => (
                <div key={s.label} className={`rounded-lg p-3 ${s.accent}`}>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-[11px] font-medium">{s.label}</p>
                </div>
              ));
            })()}
          </div>

          {/* Pending requests list */}
          {mockLeaveRequests.filter(r => r.status === 'Pending').length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('employees.name')}</TableHead>
                  <TableHead>{t('absence.type')}</TableHead>
                  <TableHead>{t('absence.dates')}</TableHead>
                  <TableHead>{t('absence.days')}</TableHead>
                  <TableHead>{t('employees.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockLeaveRequests.filter(r => r.status === 'Pending').slice(0, 4).map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.employeeName}</TableCell>
                    <TableCell>{req.leaveType}</TableCell>
                    <TableCell className="text-xs">{req.startDate} → {req.endDate}</TableCell>
                    <TableCell>{req.days}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-cores-orange text-cores-orange text-[11px]">
                        {t('absence.pending')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;

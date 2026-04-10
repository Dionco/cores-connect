import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmployees } from '@/hooks/useEmployees';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import OnboardingTab from '@/components/onboarding/OnboardingTab';

const EmployeeProfile = () => {
  const { id } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { employees } = useEmployees();
  const emp = employees.find(e => e.id === id);
  const requestedTab = searchParams.get('tab');
  const defaultTab =
    requestedTab === 'onboarding' || requestedTab === 'provisioning' || requestedTab === 'details'
      ? requestedTab
      : 'details';

  if (!emp) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Employee not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/employees')} className="gap-2 text-muted-foreground">
        <ArrowLeft size={16} /> {t('profile.back')}
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-foreground">
              {emp.firstName[0]}{emp.lastName[0]}
            </div>
            <h2 className="text-lg font-bold text-foreground">{emp.firstName} {emp.lastName}</h2>
            <p className="text-sm text-muted-foreground">{emp.role}</p>
            <p className="text-sm text-muted-foreground">{emp.department}</p>
            <div className="mt-3">
              <StatusBadge status={emp.status} />
            </div>
            <div className="mt-6 w-full space-y-2 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('employees.startDate')}</span>
                <span className="font-medium">{emp.startDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('profile.employeeId')}</span>
                <span className="font-medium font-mono text-xs">{emp.id}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right column with tabs */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-6">
            <Tabs defaultValue={defaultTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="details">{t('profile.details')}</TabsTrigger>
                <TabsTrigger value="onboarding">{t('profile.onboarding')}</TabsTrigger>
                <TabsTrigger value="provisioning">{t('profile.provisioning')}</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { label: t('employees.name'), value: `${emp.firstName} ${emp.lastName}` },
                    { label: t('profile.email'), value: emp.email || '—' },
                    { label: t('employees.workPhone'), value: emp.workPhone || '—' },
                    { label: t('profile.personalPhone'), value: emp.personalPhone || '—' },
                    { label: t('employees.department'), value: emp.department },
                    { label: t('employees.role'), value: emp.role },
                    { label: t('employees.startDate'), value: emp.startDate },
                    { label: t('profile.contractType'), value: emp.contractType },
                  ].map((field) => (
                    <div key={field.label}>
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p className="text-sm font-medium text-foreground">{field.value}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="onboarding">
                <OnboardingTab employee={emp} />
              </TabsContent>

              <TabsContent value="provisioning">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Microsoft 365</h3>
                  <div className="space-y-2">
                    {emp.provisioningItems.filter(p => p.service === 'M365').map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                        {item.completed ? (
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        ) : (
                          <Clock size={18} className="text-cores-orange" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.label}</p>
                          {item.timestamp && <p className="text-xs text-muted-foreground">{item.timestamp}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mt-4">Apple Business Manager</h3>
                  <div className="space-y-2">
                    {emp.provisioningItems.filter(p => p.service === 'Apple').map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                        {item.completed ? (
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        ) : (
                          <Clock size={18} className="text-cores-orange" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.label}</p>
                          {item.timestamp && <p className="text-xs text-muted-foreground">{item.timestamp}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeeProfile;

import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { mockEmployees, mockLeaveBalances, mockLeaveRequests, LeaveRequest, LeaveType, LeaveStatus } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusBadge from '@/components/StatusBadge';
import { CalendarDays, CalendarIcon, Check, Clock, Plus, Umbrella, X, Baby, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, eachDayOfInterval, parseISO, isSameMonth, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const CURRENT_USER_ID = 'emp-001'; // Simulated logged-in user

const AbsencePage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(mockLeaveRequests);
  const [balances, setBalances] = useState(mockLeaveBalances);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Form state
  const [formLeaveType, setFormLeaveType] = useState<LeaveType>('Vacation');
  const [formStartDate, setFormStartDate] = useState<Date>();
  const [formEndDate, setFormEndDate] = useState<Date>();
  const [formSubstitute, setFormSubstitute] = useState<string>('');

  const myBalance = balances.find(b => b.userId === CURRENT_USER_ID);
  const myRequests = leaveRequests.filter(r => r.userId === CURRENT_USER_ID);
  const pendingRequests = leaveRequests.filter(r => r.status === 'Pending');
  const approvedRequests = leaveRequests.filter(r => r.status === 'Approved');

  const activeEmployees = mockEmployees.filter(e => e.status === 'Active' || e.status === 'Onboarding');
  const otherEmployees = activeEmployees.filter(e => e.id !== CURRENT_USER_ID);

  const leaveTypeIcon = (type: LeaveType) => {
    switch (type) {
      case 'Vacation': return <Umbrella size={14} />;
      case 'Sick': return <Plus size={14} className="rotate-45" />;
      case 'Parental': return <Baby size={14} />;
    }
  };

  const leaveTypeColor = (type: LeaveType) => {
    switch (type) {
      case 'Vacation': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Sick': return 'bg-red-100 text-red-700 border-red-200';
      case 'Parental': return 'bg-purple-100 text-purple-700 border-purple-200';
    }
  };

  const leaveTypeBg = (type: LeaveType) => {
    switch (type) {
      case 'Vacation': return 'bg-blue-500';
      case 'Sick': return 'bg-red-500';
      case 'Parental': return 'bg-purple-500';
    }
  };

  const translateLeaveType = (type: LeaveType) => {
    switch (type) {
      case 'Vacation': return t('absence.vacation');
      case 'Sick': return t('absence.sick');
      case 'Parental': return t('absence.parental');
    }
  };

  const translateStatus = (status: LeaveStatus) => {
    switch (status) {
      case 'Pending': return t('status.pending');
      case 'Approved': return t('absence.approved');
      case 'Rejected': return t('absence.rejected');
    }
  };

  const statusColor = (status: LeaveStatus) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700';
      case 'Approved': return 'bg-emerald-100 text-emerald-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
    }
  };

  const calculateDays = (start: Date, end: Date) => {
    const days = eachDayOfInterval({ start, end });
    return days.filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
  };

  const handleSubmitRequest = () => {
    if (!formStartDate || !formEndDate) return;
    const days = calculateDays(formStartDate, formEndDate);
    const emp = mockEmployees.find(e => e.id === CURRENT_USER_ID)!;
    const newRequest: LeaveRequest = {
      id: `lr-${Date.now()}`,
      userId: CURRENT_USER_ID,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      leaveType: formLeaveType,
      startDate: format(formStartDate, 'yyyy-MM-dd'),
      endDate: format(formEndDate, 'yyyy-MM-dd'),
      substituteUserId: formSubstitute || undefined,
      status: 'Pending',
      createdAt: format(new Date(), 'yyyy-MM-dd'),
      days,
    };
    setLeaveRequests(prev => [newRequest, ...prev]);
    if (myBalance) {
      setBalances(prev => prev.map(b => b.userId === CURRENT_USER_ID
        ? { ...b, pendingDays: b.pendingDays + days, remainingDays: b.remainingDays - days }
        : b
      ));
    }
    setShowRequestModal(false);
    setFormStartDate(undefined);
    setFormEndDate(undefined);
    setFormSubstitute('');
    setFormLeaveType('Vacation');
    toast({ title: t('absence.requestSubmitted') });
  };

  const handleApprove = (requestId: string) => {
    setLeaveRequests(prev => prev.map(r => {
      if (r.id !== requestId) return r;
      setBalances(bs => bs.map(b => b.userId === r.userId
        ? { ...b, pendingDays: b.pendingDays - r.days, usedDays: b.usedDays + r.days }
        : b
      ));
      return { ...r, status: 'Approved' as LeaveStatus };
    }));
    toast({ title: t('absence.requestApproved') });
  };

  const handleReject = (requestId: string) => {
    setLeaveRequests(prev => prev.map(r => {
      if (r.id !== requestId) return r;
      setBalances(bs => bs.map(b => b.userId === r.userId
        ? { ...b, pendingDays: b.pendingDays - r.days, remainingDays: b.remainingDays + r.days }
        : b
      ));
      return { ...r, status: 'Rejected' as LeaveStatus };
    }));
    toast({ title: t('absence.requestRejected') });
  };

  // Team Calendar logic
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const getLeaveForDay = (day: Date) => {
    return approvedRequests.filter(r => {
      const start = parseISO(r.startDate);
      const end = parseISO(r.endDate);
      return day >= start && day <= end;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('absence.title')}</h1>
      </div>

      <Tabs defaultValue="myLeave">
        <TabsList>
          <TabsTrigger value="myLeave">{t('absence.myLeave')}</TabsTrigger>
          <TabsTrigger value="approvals">{t('absence.approvals')}</TabsTrigger>
          <TabsTrigger value="calendar">{t('absence.teamCalendar')}</TabsTrigger>
        </TabsList>

        {/* ===== MY LEAVE TAB ===== */}
        <TabsContent value="myLeave" className="space-y-6">
          {/* Balance cards */}
          {myBalance && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: t('absence.totalDays'), value: myBalance.totalAnnualDays, icon: CalendarDays, color: 'text-blue-600 bg-blue-50' },
                { label: t('absence.taken'), value: myBalance.usedDays, icon: Check, color: 'text-emerald-600 bg-emerald-50' },
                { label: t('absence.pending'), value: myBalance.pendingDays, icon: Clock, color: 'text-amber-600 bg-amber-50' },
                { label: t('absence.remaining'), value: myBalance.remainingDays, icon: Umbrella, color: 'text-primary bg-primary/10' },
              ].map((card) => (
                <Card key={card.label} className="border-0 shadow-sm">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', card.color)}>
                      <card.icon size={20} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => setShowRequestModal(true)}
              className="bg-gradient-to-r from-[hsl(var(--cores-teal))] to-[hsl(var(--cores-green))] text-white hover:opacity-90"
            >
              <Plus size={16} className="mr-1" /> {t('absence.requestLeave')}
            </Button>
          </div>

          {/* History table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="p-5 pb-0">
                <h2 className="text-lg font-semibold text-foreground">{t('absence.history')}</h2>
              </div>
              {myRequests.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <CalendarDays size={40} className="mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t('absence.noRequests')}</p>
                  <p className="text-xs text-muted-foreground/70">{t('absence.noRequestsDesc')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('absence.type')}</TableHead>
                      <TableHead>{t('absence.dates')}</TableHead>
                      <TableHead>{t('absence.daysCount')}</TableHead>
                      <TableHead>{t('absence.substitute')}</TableHead>
                      <TableHead>{t('employees.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myRequests.map((req) => {
                      const sub = req.substituteUserId ? mockEmployees.find(e => e.id === req.substituteUserId) : null;
                      return (
                        <TableRow key={req.id}>
                          <TableCell>
                            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', leaveTypeColor(req.leaveType))}>
                              {leaveTypeIcon(req.leaveType)} {translateLeaveType(req.leaveType)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{req.startDate} → {req.endDate}</TableCell>
                          <TableCell className="text-sm font-medium">{req.days}</TableCell>
                          <TableCell className="text-sm">{sub ? `${sub.firstName} ${sub.lastName}` : '—'}</TableCell>
                          <TableCell>
                            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusColor(req.status))}>
                              {translateStatus(req.status)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== APPROVALS TAB ===== */}
        <TabsContent value="approvals" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="p-5 pb-0">
                <h2 className="text-lg font-semibold text-foreground">{t('absence.approvals')}</h2>
              </div>
              {pendingRequests.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Check size={40} className="mb-3 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t('absence.noPending')}</p>
                  <p className="text-xs text-muted-foreground/70">{t('absence.noPendingDesc')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('absence.employee')}</TableHead>
                      <TableHead>{t('absence.type')}</TableHead>
                      <TableHead>{t('absence.dates')}</TableHead>
                      <TableHead>{t('absence.daysCount')}</TableHead>
                      <TableHead>{t('absence.substitute')}</TableHead>
                      <TableHead>{t('employees.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((req) => {
                      const sub = req.substituteUserId ? mockEmployees.find(e => e.id === req.substituteUserId) : null;
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">{req.employeeName}</TableCell>
                          <TableCell>
                            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', leaveTypeColor(req.leaveType))}>
                              {leaveTypeIcon(req.leaveType)} {translateLeaveType(req.leaveType)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{req.startDate} → {req.endDate}</TableCell>
                          <TableCell className="text-sm font-medium">{req.days}</TableCell>
                          <TableCell className="text-sm">{sub ? `${sub.firstName} ${sub.lastName}` : '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-8 border-emerald-300 text-emerald-600 hover:bg-emerald-50" onClick={() => handleApprove(req.id)}>
                                <Check size={14} className="mr-1" /> {t('absence.approve')}
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleReject(req.id)}>
                                <X size={14} className="mr-1" /> {t('absence.reject')}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TEAM CALENDAR TAB ===== */}
        <TabsContent value="calendar" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(prev => subMonths(prev, 1))}>
                  <ChevronLeft size={18} />
                </Button>
                <h2 className="text-lg font-semibold text-foreground">
                  {format(calendarMonth, 'MMMM yyyy')}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(prev => addMonths(prev, 1))}>
                  <ChevronRight size={18} />
                </Button>
              </div>

              {/* Legend */}
              <div className="flex gap-4 mb-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-blue-500" /> {t('absence.vacation')}</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-red-500" /> {t('absence.sick')}</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-purple-500" /> {t('absence.parental')}</span>
              </div>

              {/* Calendar grid */}
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                      <div key={d} className="py-2">{d}</div>
                    ))}
                  </div>

                  {/* Weeks */}
                  {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 border-t">
                      {week.map((day, di) => {
                        const isCurrentMonth = isSameMonth(day, calendarMonth);
                        const isToday = isSameDay(day, new Date());
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        const dayLeaves = getLeaveForDay(day);

                        return (
                          <div
                            key={di}
                            className={cn(
                              'min-h-[80px] p-1 border-r last:border-r-0 text-xs',
                              !isCurrentMonth && 'bg-muted/30 text-muted-foreground/40',
                              isWeekend && 'bg-muted/20',
                            )}
                          >
                            <div className={cn(
                              'mb-1 font-medium',
                              isToday && 'flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground'
                            )}>
                              {format(day, 'd')}
                            </div>
                            <div className="space-y-0.5">
                              {dayLeaves.slice(0, 3).map((leave) => {
                                const emp = mockEmployees.find(e => e.id === leave.userId);
                                return (
                                  <div
                                    key={leave.id}
                                    className={cn('truncate rounded px-1 py-0.5 text-white text-[10px] font-medium', leaveTypeBg(leave.leaveType))}
                                    title={`${leave.employeeName} - ${leave.leaveType}`}
                                  >
                                    {emp ? emp.firstName : leave.employeeName.split(' ')[0]}
                                  </div>
                                );
                              })}
                              {dayLeaves.length > 3 && (
                                <div className="text-muted-foreground text-[10px]">+{dayLeaves.length - 3} more</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== REQUEST LEAVE MODAL ===== */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('absence.requestLeave')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Leave type */}
            <div>
              <label className="text-sm font-medium text-foreground">{t('absence.leaveType')}</label>
              <Select value={formLeaveType} onValueChange={(v) => setFormLeaveType(v as LeaveType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vacation">{t('absence.vacation')}</SelectItem>
                  <SelectItem value="Sick">{t('absence.sick')}</SelectItem>
                  <SelectItem value="Parental">{t('absence.parental')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start date */}
            <div>
              <label className="text-sm font-medium text-foreground">{t('absence.startDate')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('mt-1 w-full justify-start text-left font-normal', !formStartDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formStartDate ? format(formStartDate, 'PPP') : t('absence.startDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={formStartDate} onSelect={setFormStartDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* End date */}
            <div>
              <label className="text-sm font-medium text-foreground">{t('absence.endDate')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('mt-1 w-full justify-start text-left font-normal', !formEndDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formEndDate ? format(formEndDate, 'PPP') : t('absence.endDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={formEndDate} onSelect={setFormEndDate} initialFocus className="p-3 pointer-events-auto" disabled={(date) => formStartDate ? date < formStartDate : false} />
                </PopoverContent>
              </Popover>
            </div>

            {/* Business days preview */}
            {formStartDate && formEndDate && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <span className="font-medium">{calculateDays(formStartDate, formEndDate)}</span> {t('absence.daysCount').toLowerCase()} ({t('absence.remaining')}: {myBalance ? myBalance.remainingDays - calculateDays(formStartDate, formEndDate) : '—'})
              </div>
            )}

            {/* Substitute */}
            <div>
              <label className="text-sm font-medium text-foreground">{t('absence.substitute')}</label>
              <Select value={formSubstitute} onValueChange={setFormSubstitute}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t('absence.selectSubstitute')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('absence.none')}</SelectItem>
                  {otherEmployees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-[hsl(var(--cores-teal))] to-[hsl(var(--cores-green))] text-white hover:opacity-90"
              onClick={handleSubmitRequest}
              disabled={!formStartDate || !formEndDate}
            >
              {t('absence.submitRequest')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AbsencePage;

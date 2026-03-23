import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { mockEmployees, departments, type Department, type EmployeeStatus } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Plus, MoreVertical, Users } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import AddEmployeeDialog from '@/components/AddEmployeeDialog';

const EmployeesPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const filtered = mockEmployees.filter((emp) => {
    const matchSearch = `${emp.firstName} ${emp.lastName} ${emp.role}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchDept = deptFilter === 'all' || emp.department === deptFilter;
    const matchStatus = statusFilter === 'all' || emp.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const statuses: EmployeeStatus[] = ['Active', 'Inactive', 'Onboarding'];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('employees.title')}</h1>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="text-white font-semibold"
          style={{ background: 'linear-gradient(135deg, #84e9e9, #84e988)' }}
        >
          <Plus size={16} />
          {t('employees.addNew')}
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('employees.search')}
              className="pl-9"
            />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={t('employees.allDepartments')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('employees.allDepartments')}</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={t('employees.allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('employees.allStatuses')}</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-muted p-4 mb-4">
                <Users size={32} className="text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">{t('employees.noEmployees')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('employees.addFirst')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('employees.name')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('employees.department')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('employees.role')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('employees.startDate')}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t('employees.workPhone')}</TableHead>
                  <TableHead>{t('employees.status')}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/employees/${emp.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-foreground">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{emp.department}</TableCell>
                    <TableCell className="hidden lg:table-cell">{emp.role}</TableCell>
                    <TableCell className="hidden sm:table-cell">{emp.startDate}</TableCell>
                    <TableCell className="hidden xl:table-cell">{emp.workPhone || '—'}</TableCell>
                    <TableCell><StatusBadge status={emp.status} /></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} className="rounded-md p-1.5 hover:bg-muted">
                          <MoreVertical size={16} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/employees/${emp.id}`); }}>
                            {t('employees.viewProfile')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                            {t('employees.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled onClick={(e) => e.stopPropagation()} className="text-muted-foreground">
                            {t('employees.offboard')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddEmployeeDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  );
};

export default EmployeesPage;

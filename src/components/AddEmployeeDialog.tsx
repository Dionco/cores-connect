import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { departments, contractTypes } from '@/data/mockData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddEmployeeDialog = ({ open, onOpenChange }: AddEmployeeDialogProps) => {
  const { t } = useLanguage();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [contractType, setContractType] = useState('');
  const [workPhone, setWorkPhone] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const handleSave = () => {
    const newErrors: Record<string, boolean> = {};
    if (!firstName) newErrors.firstName = true;
    if (!lastName) newErrors.lastName = true;
    if (!role) newErrors.role = true;
    if (!department) newErrors.department = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    toast({
      title: 'Employee added',
      description: `${firstName} ${lastName} has been added. Provisioning started.`,
    });

    onOpenChange(false);
    setFirstName(''); setLastName(''); setPersonalEmail('');
    setRole(''); setDepartment(''); setStartDate(undefined);
    setContractType(''); setWorkPhone(''); setPersonalPhone('');
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{t('employees.addNew')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('form.firstName')} *</Label>
              <Input value={firstName} onChange={(e) => { setFirstName(e.target.value); setErrors(prev => ({ ...prev, firstName: false })); }}
                className={errors.firstName ? 'border-destructive' : ''} />
              {errors.firstName && <p className="text-xs text-destructive mt-1">{t('form.required')}</p>}
            </div>
            <div>
              <Label className="text-xs">{t('form.lastName')} *</Label>
              <Input value={lastName} onChange={(e) => { setLastName(e.target.value); setErrors(prev => ({ ...prev, lastName: false })); }}
                className={errors.lastName ? 'border-destructive' : ''} />
              {errors.lastName && <p className="text-xs text-destructive mt-1">{t('form.required')}</p>}
            </div>
          </div>

          <div>
            <Label className="text-xs">{t('form.personalEmail')}</Label>
            <Input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">{t('form.role')} *</Label>
            <Input value={role} onChange={(e) => { setRole(e.target.value); setErrors(prev => ({ ...prev, role: false })); }}
              className={errors.role ? 'border-destructive' : ''} />
            {errors.role && <p className="text-xs text-destructive mt-1">{t('form.required')}</p>}
          </div>

          <div>
            <Label className="text-xs">{t('form.department')} *</Label>
            <Select value={department} onValueChange={(v) => { setDepartment(v); setErrors(prev => ({ ...prev, department: false })); }}>
              <SelectTrigger className={errors.department ? 'border-destructive' : ''}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.department && <p className="text-xs text-destructive mt-1">{t('form.required')}</p>}
          </div>

          <div>
            <Label className="text-xs">{t('form.startDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="text-xs">{t('form.contractType')}</Label>
            <Select value={contractType} onValueChange={setContractType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {contractTypes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('form.workPhone')}</Label>
              <Input value={workPhone} onChange={(e) => setWorkPhone(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t('form.personalPhone')}</Label>
              <Input value={personalPhone} onChange={(e) => setPersonalPhone(e.target.value)} />
            </div>
          </div>

          {/* Info box */}
          <div className="flex gap-3 rounded-lg bg-amber-50 p-3 border border-amber-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-cores-orange" />
            <p className="text-xs text-foreground leading-relaxed">{t('form.provisioningInfo')}</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('form.cancel')}</Button>
            <Button onClick={handleSave} className="text-white font-semibold" style={{ background: 'linear-gradient(135deg, #84e9e9, #84e988)' }}>
              {t('form.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmployeeDialog;

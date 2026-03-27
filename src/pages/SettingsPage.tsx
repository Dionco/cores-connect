import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Trash2, Plus } from 'lucide-react';

const SettingsPage = () => {
  const { t } = useLanguage();

  const [companyName, setCompanyName] = useState('Cores');
  const [domain, setDomain] = useState('@cores.nl');
  const [depts, setDepts] = useState(['Sales', 'Customs & Compliance', 'Transport']);
  const [newDept, setNewDept] = useState('');
  const [licenseType, setLicenseType] = useState('Business Premium');
  const [spGroup, setSpGroup] = useState('Cores');
  const [appleIdDomain, setAppleIdDomain] = useState('cores.nl');
  const [wifiSsid, setWifiSsid] = useState('Cores-WiFi');
  const [wifiPassword, setWifiPassword] = useState('');
  const [spUrl, setSpUrl] = useState('https://cores.sharepoint.com');
  const [sliteUrl, setSliteUrl] = useState('https://slite.com');
  const [tribeCrmUrl, setTribeCrmUrl] = useState('https://tribe.so');
  const [itEmail, setItEmail] = useState('it@cores.nl');
  const [emailNotif, setEmailNotif] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);

  const mailboxMap = [
    { dept: 'Sales', mailboxes: ['sales@cores.nl', 'trading@cores.nl'] },
    { dept: 'Customs & Compliance', mailboxes: ['customs@cores.nl'] },
    { dept: 'Transport', mailboxes: ['transport@cores.nl'] },
    { dept: 'Everyone', mailboxes: ['SharePoint group "Cores"'] },
  ];

  const handleSave = () => {
    toast({ title: t('settings.save'), description: 'Settings saved successfully.' });
  };

  const addDept = () => {
    if (newDept.trim() && !depts.includes(newDept.trim())) {
      setDepts([...depts, newDept.trim()]);
      setNewDept('');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>

      {/* Company */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">{t('settings.company')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">{t('settings.companyName')}</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t('settings.domain')}</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Departments */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">{t('settings.departments')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {depts.map((d) => (
            <div key={d} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium">{d}</span>
              <Button size="sm" variant="ghost" onClick={() => setDepts(depts.filter(x => x !== d))}><Trash2 size={14} /></Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="New department" className="flex-1" />
            <Button size="sm" variant="outline" onClick={addDept}><Plus size={14} /> {t('settings.add')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Shared Mailboxes */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">{t('settings.sharedMailboxes')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {mailboxMap.map((m) => (
            <div key={m.dept} className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-foreground">{m.dept}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {m.mailboxes.map((mb) => (
                  <span key={mb} className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-foreground">{mb}</span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Provisioning Defaults */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">{t('settings.provisioningDefaults')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label className="text-xs">{t('settings.licenseType')}</Label><Input value={licenseType} onChange={(e) => setLicenseType(e.target.value)} /></div>
          <div><Label className="text-xs">{t('settings.sharepointGroup')}</Label><Input value={spGroup} onChange={(e) => setSpGroup(e.target.value)} /></div>
          <div><Label className="text-xs">{t('settings.appleIdDomain')}</Label><Input value={appleIdDomain} onChange={(e) => setAppleIdDomain(e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Login PDF Template */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">{t('settings.loginPdfTemplate')}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><Label className="text-xs">{t('settings.wifiSsid')}</Label><Input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} /></div>
          <div><Label className="text-xs">{t('settings.wifiPassword')}</Label><Input type="password" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} /></div>
          <div><Label className="text-xs">{t('settings.sharepointUrl')}</Label><Input value={spUrl} onChange={(e) => setSpUrl(e.target.value)} /></div>
          <div><Label className="text-xs">{t('settings.sliteUrl')}</Label><Input value={sliteUrl} onChange={(e) => setSliteUrl(e.target.value)} /></div>
          <div><Label className="text-xs">{t('settings.tribeCrmUrl')}</Label><Input value={tribeCrmUrl} onChange={(e) => setTribeCrmUrl(e.target.value)} /></div>
          <div><Label className="text-xs">{t('settings.itContactEmail')}</Label><Input value={itEmail} onChange={(e) => setItEmail(e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">{t('settings.notifications')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t('settings.emailNotifications')}</Label>
            <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label>{t('settings.inAppNotifications')}</Label>
            <Switch checked={inAppNotif} onCheckedChange={setInAppNotif} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="text-white font-semibold" style={{ background: 'linear-gradient(135deg, #84e9e9, #84e988)' }}>
        {t('settings.save')}
      </Button>
    </div>
  );
};

export default SettingsPage;

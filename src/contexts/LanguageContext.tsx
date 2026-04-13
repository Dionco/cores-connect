/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onboardingTranslations } from '@/data/onboardingTranslations';

type Language = 'en' | 'nl';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const baseTranslations: Record<string, Record<Language, string>> = {
  // Nav
  'nav.dashboard': { en: 'Dashboard', nl: 'Dashboard' },
  'nav.employees': { en: 'Employees', nl: 'Medewerkers' },
  'nav.onboarding': { en: 'Onboarding', nl: 'Onboarding' },
  'nav.provisioning': { en: 'Provisioning', nl: 'Provisioning' },
  'nav.settings': { en: 'Settings', nl: 'Instellingen' },

  // Login
  'login.title': { en: 'Sign in to Cores HR', nl: 'Inloggen bij Cores HR' },
  'login.sso': { en: 'Sign in with Microsoft 365', nl: 'Inloggen met Microsoft 365' },
  'login.or': { en: 'or sign in with email', nl: 'of inloggen met e-mail' },
  'login.email': { en: 'Email address', nl: 'E-mailadres' },
  'login.password': { en: 'Password', nl: 'Wachtwoord' },
  'login.submit': { en: 'Sign in', nl: 'Inloggen' },

  // Dashboard
  'dashboard.title': { en: 'Dashboard', nl: 'Dashboard' },
  'dashboard.totalEmployees': { en: 'Total Employees', nl: 'Totaal Medewerkers' },
  'dashboard.activeOnboardings': { en: 'Active Onboardings', nl: 'Actieve Onboardings' },
  'dashboard.pendingProvisioning': { en: 'Pending Provisioning', nl: 'Wachtende Provisioning' },
  'dashboard.recentlyAdded': { en: 'Recently Added', nl: 'Recent Toegevoegd' },
  'dashboard.recentEmployees': { en: 'Recently Added Employees', nl: 'Recent Toegevoegde Medewerkers' },
  'dashboard.onboardingProgress': { en: 'Onboarding Progress', nl: 'Onboarding Voortgang' },
  'dashboard.last30days': { en: 'Last 30 days', nl: 'Laatste 30 dagen' },
  'dashboard.absence': { en: 'Absence Overview', nl: 'Verzuimoverzicht' },
  'dashboard.viewAll': { en: 'View all', nl: 'Bekijk alles' },
  'absence.pendingRequests': { en: 'Pending Requests', nl: 'Openstaande Aanvragen' },
  'absence.totalDaysTaken': { en: 'Total Days Taken', nl: 'Totaal Opgenomen' },
  'absence.days': { en: 'Days', nl: 'Dagen' },

  // Employees
  'employees.title': { en: 'Employees', nl: 'Medewerkers' },
  'employees.addNew': { en: 'Add Employee', nl: 'Medewerker Toevoegen' },
  'employees.name': { en: 'Name', nl: 'Naam' },
  'employees.department': { en: 'Department', nl: 'Afdeling' },
  'employees.role': { en: 'Role', nl: 'Functie' },
  'employees.startDate': { en: 'Start Date', nl: 'Startdatum' },
  'employees.workPhone': { en: 'Work Phone', nl: 'Werktelefoon' },
  'employees.status': { en: 'Status', nl: 'Status' },
  'employees.actions': { en: 'Actions', nl: 'Acties' },
  'employees.search': { en: 'Search employees...', nl: 'Zoek medewerkers...' },
  'employees.allDepartments': { en: 'All Departments', nl: 'Alle Afdelingen' },
  'employees.allStatuses': { en: 'All Statuses', nl: 'Alle Statussen' },
  'employees.viewProfile': { en: 'View Profile', nl: 'Bekijk Profiel' },
  'employees.edit': { en: 'Edit', nl: 'Bewerken' },
  'employees.offboard': { en: 'Offboard', nl: 'Uitdienst' },
  'employees.noEmployees': { en: 'No employees found', nl: 'Geen medewerkers gevonden' },
  'employees.addFirst': { en: 'Add your first employee to get started', nl: 'Voeg uw eerste medewerker toe om te beginnen' },

  // Employee form
  'form.firstName': { en: 'First Name', nl: 'Voornaam' },
  'form.lastName': { en: 'Last Name', nl: 'Achternaam' },
  'form.personalEmail': { en: 'Personal Email', nl: 'Persoonlijk E-mail' },
  'form.role': { en: 'Role / Job Title', nl: 'Functie / Titel' },
  'form.department': { en: 'Department', nl: 'Afdeling' },
  'form.startDate': { en: 'Start Date', nl: 'Startdatum' },
  'form.contractType': { en: 'Contract Type', nl: 'Contracttype' },
  'form.workPhone': { en: 'Work Phone', nl: 'Werktelefoon' },
  'form.personalPhone': { en: 'Personal Phone', nl: 'Persoonlijk Telefoon' },
  'form.save': { en: 'Save & Start Provisioning', nl: 'Opslaan & Provisioning Starten' },
  'form.cancel': { en: 'Cancel', nl: 'Annuleren' },
  'form.required': { en: 'This field is required', nl: 'Dit veld is verplicht' },
  'form.provisioningInfo': { en: 'Saving this employee will immediately trigger Microsoft 365 account creation and Apple Business Manager provisioning.', nl: 'Het opslaan van deze medewerker activeert direct het aanmaken van een Microsoft 365 account en Apple Business Manager provisioning.' },
  'addEmployee.securityGroups.help': { en: 'Choose the folder permissions this employee should receive. Select Read or Edit per folder.', nl: 'Kies de maprechten die deze medewerker moet krijgen. Selecteer Lezen of Bewerken per map.' },
  'addEmployee.securityGroups.none': { en: 'No security groups available.', nl: 'Geen beveiligingsgroepen beschikbaar.' },
  'addEmployee.securityGroups.noneMatched': { en: 'No SharePoint folder groups matched the expected naming pattern.', nl: 'Geen SharePoint-mapgroepen komen overeen met het verwachte naamformaat.' },
  'addEmployee.securityGroups.otherSection': { en: 'Other groups', nl: 'Overige groepen' },
  'addEmployee.securityGroups.permission.read': { en: 'Read', nl: 'Lezen' },
  'addEmployee.securityGroups.permission.edit': { en: 'Edit', nl: 'Bewerken' },

  // Profile
  'profile.details': { en: 'Details', nl: 'Details' },
  'profile.onboarding': { en: 'Onboarding', nl: 'Onboarding' },
  'profile.provisioning': { en: 'Provisioning', nl: 'Provisioning' },
  'profile.documents': { en: 'Documents', nl: 'Documenten' },
  'profile.credentials': { en: 'App Access', nl: 'App-toegang' },

  // App credentials
  'credentials.add': { en: 'Add app login', nl: 'App-login toevoegen' },
  'credentials.addTitle': { en: 'Add app login', nl: 'App-login toevoegen' },
  'credentials.editTitle': { en: 'Edit app login', nl: 'App-login bewerken' },
  'credentials.appName': { en: 'App name', nl: 'App-naam' },
  'credentials.appNameRequired': { en: 'App name is required', nl: 'App-naam is verplicht' },
  'credentials.loginUrl': { en: 'Login URL', nl: 'Login-URL' },
  'credentials.username': { en: 'Username / email', nl: 'Gebruikersnaam / e-mail' },
  'credentials.password': { en: 'Password', nl: 'Wachtwoord' },
  'credentials.passwordLeaveBlank': { en: '(leave blank to keep current)', nl: '(leeg laten om te behouden)' },
  'credentials.notes': { en: 'Notes', nl: 'Notities' },
  'credentials.save': { en: 'Save', nl: 'Opslaan' },
  'credentials.cancel': { en: 'Cancel', nl: 'Annuleren' },
  'credentials.created': { en: 'App login added', nl: 'App-login toegevoegd' },
  'credentials.updated': { en: 'App login updated', nl: 'App-login bijgewerkt' },
  'credentials.deleted': { en: 'App login deleted', nl: 'App-login verwijderd' },
  'credentials.saveFailed': { en: 'Failed to save', nl: 'Opslaan mislukt' },
  'credentials.deleteFailed': { en: 'Failed to delete', nl: 'Verwijderen mislukt' },
  'credentials.revealFailed': { en: 'Failed to reveal password', nl: 'Wachtwoord ophalen mislukt' },
  'credentials.loading': { en: 'Loading…', nl: 'Laden…' },
  'credentials.empty': { en: 'No app logins stored yet.', nl: 'Nog geen app-logins opgeslagen.' },
  'credentials.passwordSet': { en: 'password saved', nl: 'wachtwoord opgeslagen' },
  'credentials.noPassword': { en: 'no password', nl: 'geen wachtwoord' },
  'credentials.noUsername': { en: 'no username', nl: 'geen gebruikersnaam' },
  'credentials.passwordCopied': { en: 'Password copied to clipboard', nl: 'Wachtwoord gekopieerd' },
  'credentials.usernameCopied': { en: 'Username copied', nl: 'Gebruikersnaam gekopieerd' },
  'credentials.clipboardWillClear': { en: 'Clipboard will be cleared in 20s.', nl: 'Klembord wordt na 20s gewist.' },
  'credentials.clipboardCleared': { en: 'Clipboard cleared', nl: 'Klembord gewist' },
  'credentials.deleteConfirmTitle': { en: 'Delete app login?', nl: 'App-login verwijderen?' },
  'credentials.deleteConfirmDescription': { en: 'This permanently deletes:', nl: 'Dit verwijdert definitief:' },
  'credentials.delete': { en: 'Delete', nl: 'Verwijderen' },
  'credentials.edit': { en: 'Edit', nl: 'Bewerken' },
  'credentials.open': { en: 'Open', nl: 'Openen' },
  'credentials.copyUsername': { en: 'Copy username', nl: 'Gebruikersnaam kopiëren' },
  'credentials.reveal': { en: 'Show password', nl: 'Wachtwoord tonen' },
  'credentials.hide': { en: 'Hide password', nl: 'Wachtwoord verbergen' },
  'credentials.copyPassword': { en: 'Copy password', nl: 'Wachtwoord kopiëren' },
  'credentials.securityNotice': {
    en: 'Passwords are encrypted at rest. Every reveal is logged.',
    nl: 'Wachtwoorden zijn versleuteld opgeslagen. Elk inkijken wordt gelogd.',
  },

  // Documents tab
  'documents.category': { en: 'Category', nl: 'Categorie' },
  'documents.category.onboarding': { en: 'Onboarding', nl: 'Onboarding' },
  'documents.category.signature': { en: 'Email signature', nl: 'E-mailhandtekening' },
  'documents.category.contract': { en: 'Contract', nl: 'Contract' },
  'documents.category.id': { en: 'ID document', nl: 'Legitimatie' },
  'documents.category.other': { en: 'Other', nl: 'Overig' },
  'documents.upload': { en: 'Upload files', nl: 'Bestanden uploaden' },
  'documents.dropzone': { en: 'Drag & drop files here, or use the upload button. Max 25 MB.', nl: 'Sleep bestanden hierheen, of gebruik de upload-knop. Max 25 MB.' },
  'documents.loading': { en: 'Loading documents…', nl: 'Documenten laden…' },
  'documents.emptyCategory': { en: 'No documents yet.', nl: 'Nog geen documenten.' },
  'documents.uploadSuccess': { en: 'Document uploaded', nl: 'Document geüpload' },
  'documents.uploadFailed': { en: 'Upload failed', nl: 'Upload mislukt' },
  'documents.downloadFailed': { en: 'Download failed', nl: 'Download mislukt' },
  'documents.deleteSuccess': { en: 'Document deleted', nl: 'Document verwijderd' },
  'documents.deleteFailed': { en: 'Delete failed', nl: 'Verwijderen mislukt' },
  'documents.deleteConfirmTitle': { en: 'Delete document?', nl: 'Document verwijderen?' },
  'documents.deleteConfirmDescription': { en: 'This permanently deletes:', nl: 'Dit verwijdert definitief:' },
  'documents.delete': { en: 'Delete', nl: 'Verwijderen' },
  'documents.cancel': { en: 'Cancel', nl: 'Annuleren' },
  'documents.generateSignature': { en: 'Generate signature', nl: 'Handtekening maken' },
  'documents.signatureTitle': { en: 'Generate email signature', nl: 'E-mailhandtekening genereren' },
  'documents.signatureLocale': { en: 'Language', nl: 'Taal' },
  'documents.signatureFullName': { en: 'Full name', nl: 'Volledige naam' },
  'documents.signatureRole': { en: 'Role / title', nl: 'Functie' },
  'documents.signaturePhone': { en: 'Phone', nl: 'Telefoon' },
  'documents.signatureAddress': { en: 'Address line', nl: 'Adresregel' },
  'documents.signaturePresence': { en: 'Presence line (optional)', nl: 'Aanwezigheid (optioneel)' },
  'documents.signaturePresencePlaceholder': { en: 'Present on Mon, Tue, Wed, Thu, Fri', nl: 'Aanwezig op ma, di, wo, do, vr' },
  'documents.signatureCopy': { en: 'Copy HTML', nl: 'HTML kopiëren' },
  'documents.signatureDownload': { en: 'Download .htm', nl: '.htm downloaden' },
  'documents.signatureSave': { en: 'Save to employee', nl: 'Opslaan bij medewerker' },
  'documents.signatureCopied': { en: 'Signature HTML copied', nl: 'HTML gekopieerd' },
  'documents.signatureSaved': { en: 'Signature saved', nl: 'Handtekening opgeslagen' },
  'documents.signatureSaveFailed': { en: 'Failed to save signature', nl: 'Opslaan mislukt' },
  'profile.email': { en: 'Email', nl: 'E-mail' },
  'profile.personalPhone': { en: 'Personal Phone', nl: 'Persoonlijk Telefoon' },
  'profile.contractType': { en: 'Contract Type', nl: 'Contracttype' },
  'profile.employeeId': { en: 'Employee ID', nl: 'Medewerker ID' },
  'profile.back': { en: 'Back to Employees', nl: 'Terug naar Medewerkers' },

  // Departments
  'dept.sales': { en: 'Sales', nl: 'Verkoop' },
  'dept.customs': { en: 'Customs & Compliance', nl: 'Douane & Compliance' },
  'dept.logistics': { en: 'Transport', nl: 'Logistiek' },

  // Statuses
  'status.active': { en: 'Active', nl: 'Actief' },
  'status.inactive': { en: 'Inactive', nl: 'Inactief' },
  'status.onboarding': { en: 'Onboarding', nl: 'Onboarding' },
  'status.provisioned': { en: 'Provisioned', nl: 'Ingericht' },
  'status.pending': { en: 'Pending', nl: 'In Afwachting' },
  'status.failed': { en: 'Failed', nl: 'Mislukt' },
  'status.completed': { en: 'Completed', nl: 'Voltooid' },
  'status.running': { en: 'Running', nl: 'Bezig' },
  'status.queued': { en: 'Queued', nl: 'In Wachtrij' },

  // Contract types
  'contract.permanent': { en: 'Permanent', nl: 'Vast' },
  'contract.intern': { en: 'Intern', nl: 'Stagiair' },
  'contract.freelance': { en: 'Freelance', nl: 'Freelance' },

  // Onboarding
  'onboarding.title': { en: 'Onboarding', nl: 'Onboarding' },
  'onboarding.progress': { en: 'Progress', nl: 'Voortgang' },
  'onboarding.daysSinceStart': { en: 'Days since start', nl: 'Dagen sinds start' },
  'onboarding.view': { en: 'View', nl: 'Bekijk' },
  'onboarding.tasks': { en: 'Tasks', nl: 'Taken' },
  'onboarding.automated': { en: 'Automated', nl: 'Geautomatiseerd' },
  'onboarding.manual': { en: 'Manual', nl: 'Handmatig' },
  'onboarding.startAutomation': { en: 'Start M365 automation', nl: 'Start M365-automatisering' },
  'onboarding.triggering': { en: 'Triggering...', nl: 'Starten...' },
  'onboarding.automationTriggered': { en: 'Automation triggered', nl: 'Automatisering gestart' },
  'onboarding.automationReused': { en: 'An active provisioning job already exists.', nl: 'Er bestaat al een actieve provisioning-taak.' },
  'onboarding.automationError': { en: 'Automation trigger failed', nl: 'Automatisering starten mislukt' },
  'onboarding.jobId': { en: 'Job ID', nl: 'Taak-ID' },
  'onboarding.retryCount': { en: 'Retry count', nl: 'Aantal retries' },
  'onboarding.noActive': { en: 'No active onboardings', nl: 'Geen actieve onboardings' },
  'onboarding.noActiveDesc': { en: 'When new employees are added, their onboarding will appear here.', nl: 'Wanneer nieuwe medewerkers worden toegevoegd, verschijnt hun onboarding hier.' },
  'onboarding.searchPlaceholder': { en: 'Search by name, department, or role...', nl: 'Zoek op naam, afdeling of functie...' },
  'onboarding.emptyFiltered': { en: 'Try adjusting your search or filters.', nl: 'Probeer uw zoekopdracht of filters aan te passen.' },
  'onboarding.filter.all': { en: 'All', nl: 'Alle' },
  'onboarding.filter.attention': { en: 'Needs Attention', nl: 'Aandacht Nodig' },
  'onboarding.filter.waiting': { en: 'Waiting', nl: 'Wachtend' },
  'onboarding.filter.new': { en: 'Not Started', nl: 'Niet Gestart' },
  'onboarding.summary.active': { en: 'Active', nl: 'Actief' },
  'onboarding.summary.inProgress': { en: 'In Progress', nl: 'In Uitvoering' },
  'onboarding.summary.waiting': { en: 'Waiting', nl: 'Wachtend' },
  'onboarding.summary.needsAttention': { en: 'Needs Attention', nl: 'Aandacht Nodig' },
  'onboarding.summary.employees': { en: 'employees onboarding', nl: 'medewerkers in onboarding' },
  'onboarding.summary.running': { en: 'workflows running', nl: 'lopende workflows' },
  'onboarding.summary.external': { en: 'waiting externally', nl: 'extern in afwachting' },
  'onboarding.summary.blockers': { en: 'blockers detected', nl: 'blokkades gevonden' },
  'onboarding.viewOnboarding': { en: 'View onboarding', nl: 'Bekijk onboarding' },

  // Onboarding tasks
  'task.m365Created': { en: 'M365 account created', nl: 'M365 account aangemaakt' },
  'task.licenseAssigned': { en: 'Business Premium licence assigned', nl: 'Business Premium licentie toegewezen' },
  'task.emailConfigured': { en: 'Email configured (name@cores.nl)', nl: 'E-mail geconfigureerd (naam@cores.nl)' },
  'task.sharedMailboxTrading': { en: 'Added to shared mailbox: trading@cores.nl', nl: 'Toegevoegd aan gedeelde mailbox: trading@cores.nl' },
  'task.sharedMailboxSales': { en: 'Added to shared mailbox: sales@cores.nl', nl: 'Toegevoegd aan gedeelde mailbox: sales@cores.nl' },
  'task.sharedMailboxCustoms': { en: 'Added to shared mailbox: customs@cores.nl', nl: 'Toegevoegd aan gedeelde mailbox: customs@cores.nl' },
  'task.sharedMailboxTransport': { en: 'Added to shared mailbox: transport@cores.nl', nl: 'Toegevoegd aan gedeelde mailbox: transport@cores.nl' },
  'task.sharepointGroup': { en: 'Added to SharePoint group "Cores"', nl: 'Toegevoegd aan SharePoint groep "Cores"' },
  'task.appleBusinessManager': { en: 'Apple Business Manager account created', nl: 'Apple Business Manager account aangemaakt' },
  'task.loginPdf': { en: 'Login details PDF generated and sent', nl: 'Inloggegevens PDF gegenereerd en verzonden' },
  'task.sliteInvite': { en: 'Slite account invite sent', nl: 'Slite account uitnodiging verzonden' },
  'task.tribeCrmInvite': { en: 'Tribe CRM account invite sent', nl: 'Tribe CRM account uitnodiging verzonden' },

  // Provisioning
  'provisioning.title': { en: 'Provisioning', nl: 'Provisioning' },
  'provisioning.employee': { en: 'Employee', nl: 'Medewerker' },
  'provisioning.service': { en: 'Service', nl: 'Service' },
  'provisioning.triggeredAt': { en: 'Triggered At', nl: 'Gestart Op' },
  'provisioning.completedAt': { en: 'Completed At', nl: 'Voltooid Op' },
  'provisioning.retry': { en: 'Retry', nl: 'Opnieuw' },
  'provisioning.log': { en: 'Provisioning Log', nl: 'Provisioning Log' },
  'provisioning.noJobs': { en: 'No provisioning jobs', nl: 'Geen provisioning taken' },
  'provisioning.noJobsDesc': { en: 'Provisioning jobs will appear here when employees are added.', nl: 'Provisioning taken verschijnen hier wanneer medewerkers worden toegevoegd.' },

  // Absence & Leave
  'nav.absence': { en: 'Absence', nl: 'Verlof' },
  'absence.title': { en: 'Absence & Leave', nl: 'Verlof & Afwezigheid' },
  'absence.myLeave': { en: 'My Leave', nl: 'Mijn Verlof' },
  'absence.approvals': { en: 'Approvals', nl: 'Goedkeuringen' },
  'absence.teamCalendar': { en: 'Team Calendar', nl: 'Teamkalender' },
  'absence.totalDays': { en: 'Total Days', nl: 'Totaal Dagen' },
  'absence.taken': { en: 'Taken', nl: 'Opgenomen' },
  'absence.pending': { en: 'Pending', nl: 'In Afwachting' },
  'absence.remaining': { en: 'Remaining', nl: 'Resterend' },
  'absence.requestLeave': { en: 'Request Leave', nl: 'Verlof Aanvragen' },
  'absence.leaveType': { en: 'Leave Type', nl: 'Verlofsoort' },
  'absence.startDate': { en: 'Start Date', nl: 'Startdatum' },
  'absence.endDate': { en: 'End Date', nl: 'Einddatum' },
  'absence.substitute': { en: 'Substitute / Cover', nl: 'Vervanger' },
  'absence.selectSubstitute': { en: 'Select a substitute...', nl: 'Selecteer een vervanger...' },
  'absence.none': { en: 'None', nl: 'Geen' },
  'absence.submitRequest': { en: 'Submit Request', nl: 'Aanvraag Indienen' },
  'absence.history': { en: 'Leave History', nl: 'Verlofgeschiedenis' },
  'absence.noRequests': { en: 'No leave requests yet', nl: 'Nog geen verlofaanvragen' },
  'absence.noRequestsDesc': { en: 'Your leave requests will appear here.', nl: 'Uw verlofaanvragen verschijnen hier.' },
  'absence.noPending': { en: 'No pending requests', nl: 'Geen openstaande aanvragen' },
  'absence.noPendingDesc': { en: 'All leave requests have been processed.', nl: 'Alle verlofaanvragen zijn verwerkt.' },
  'absence.approve': { en: 'Approve', nl: 'Goedkeuren' },
  'absence.reject': { en: 'Reject', nl: 'Afwijzen' },
  'absence.employee': { en: 'Employee', nl: 'Medewerker' },
  'absence.dates': { en: 'Dates', nl: 'Data' },
  'absence.daysCount': { en: 'Days', nl: 'Dagen' },
  'absence.type': { en: 'Type', nl: 'Type' },
  'absence.vacation': { en: 'Vacation', nl: 'Vakantie' },
  'absence.sick': { en: 'Sick', nl: 'Ziekte' },
  'absence.parental': { en: 'Parental', nl: 'Ouderschapsverlof' },
  'absence.approved': { en: 'Approved', nl: 'Goedgekeurd' },
  'absence.rejected': { en: 'Rejected', nl: 'Afgewezen' },
  'absence.requestSubmitted': { en: 'Leave request submitted', nl: 'Verlofaanvraag ingediend' },
  'absence.requestApproved': { en: 'Leave request approved', nl: 'Verlofaanvraag goedgekeurd' },
  'absence.requestRejected': { en: 'Leave request rejected', nl: 'Verlofaanvraag afgewezen' },
  'absence.requestSubmitFailed': { en: 'Failed to submit leave request', nl: 'Verlofaanvraag indienen mislukt' },
  'absence.requestActionFailed': { en: 'Failed to update leave request', nl: 'Verlofaanvraag bijwerken mislukt' },
  'absence.notificationSubmittedTitle': { en: 'Leave request submitted', nl: 'Verlofaanvraag ingediend' },
  'absence.notificationApprovedTitle': { en: 'Leave request approved', nl: 'Verlofaanvraag goedgekeurd' },
  'absence.notificationRejectedTitle': { en: 'Leave request rejected', nl: 'Verlofaanvraag afgewezen' },
  'absence.validationDatesRequired': { en: 'Start and end date are required', nl: 'Start- en einddatum zijn verplicht' },
  'absence.validationNoBusinessDays': { en: 'Choose at least one business day', nl: 'Kies minstens één werkdag' },
  'absence.validationInsufficientBalance': { en: 'Insufficient remaining leave balance', nl: 'Onvoldoende resterend verlof' },
  'absence.validationUserNotFound': { en: 'No employee profile found for your account', nl: 'Geen medewerkerprofiel gevonden voor uw account' },
  'absence.validationUnauthorized': { en: 'You are not allowed to perform this action', nl: 'U mag deze actie niet uitvoeren' },
  'absence.weekdayMon': { en: 'Mon', nl: 'Ma' },
  'absence.weekdayTue': { en: 'Tue', nl: 'Di' },
  'absence.weekdayWed': { en: 'Wed', nl: 'Wo' },
  'absence.weekdayThu': { en: 'Thu', nl: 'Do' },
  'absence.weekdayFri': { en: 'Fri', nl: 'Vr' },
  'absence.weekdaySat': { en: 'Sat', nl: 'Za' },
  'absence.weekdaySun': { en: 'Sun', nl: 'Zo' },
  'absence.previousMonth': { en: 'Previous month', nl: 'Vorige maand' },
  'absence.nextMonth': { en: 'Next month', nl: 'Volgende maand' },
  'absence.more': { en: 'more', nl: 'meer' },
  'absence.loading': { en: 'Loading leave data...', nl: 'Verlofgegevens laden...' },
  'absence.noLinkedEmployee': { en: 'Your account is not linked to an employee record yet.', nl: 'Uw account is nog niet gekoppeld aan een medewerkerrecord.' },
  'absence.selectEmployee': { en: 'Select employee...', nl: 'Selecteer medewerker...' },
  'absence.allEmployees': { en: 'All Employees', nl: 'Alle Medewerkers' },

  // Settings
  'settings.title': { en: 'Settings', nl: 'Instellingen' },
  'settings.company': { en: 'Company', nl: 'Bedrijf' },
  'settings.departments': { en: 'Departments', nl: 'Afdelingen' },
  'settings.sharedMailboxes': { en: 'Shared Mailboxes', nl: 'Gedeelde Mailboxen' },
  'settings.provisioningDefaults': { en: 'Provisioning Defaults', nl: 'Provisioning Standaarden' },
  'settings.loginPdfTemplate': { en: 'Login PDF Template', nl: 'Inlog PDF Sjabloon' },
  'settings.notifications': { en: 'Notifications', nl: 'Meldingen' },
  'settings.companyName': { en: 'Company Name', nl: 'Bedrijfsnaam' },
  'settings.domain': { en: 'Domain', nl: 'Domein' },
  'settings.logo': { en: 'Logo', nl: 'Logo' },
  'settings.licenseType': { en: 'M365 License Type', nl: 'M365 Licentietype' },
  'settings.sharepointGroup': { en: 'SharePoint Group Name', nl: 'SharePoint Groepsnaam' },
  'settings.appleIdDomain': { en: 'Apple ID Domain', nl: 'Apple ID Domein' },
  'settings.wifiSsid': { en: 'Wi-Fi SSID', nl: 'Wi-Fi SSID' },
  'settings.wifiPassword': { en: 'Wi-Fi Password', nl: 'Wi-Fi Wachtwoord' },
  'settings.sharepointUrl': { en: 'SharePoint URL', nl: 'SharePoint URL' },
  'settings.sliteUrl': { en: 'Slite URL', nl: 'Slite URL' },
  'settings.tribeCrmUrl': { en: 'Tribe CRM URL', nl: 'Tribe CRM URL' },
  'settings.itContactEmail': { en: 'IT Contact Email', nl: 'IT Contact E-mail' },
  'settings.emailNotifications': { en: 'Email Notifications', nl: 'E-mail Meldingen' },
  'settings.inAppNotifications': { en: 'In-app Notifications', nl: 'In-app Meldingen' },
  'settings.save': { en: 'Save Changes', nl: 'Wijzigingen Opslaan' },
  'settings.add': { en: 'Add', nl: 'Toevoegen' },
  'settings.delete': { en: 'Delete', nl: 'Verwijderen' },

  // Notifications
  'notifications.title': { en: 'Notifications', nl: 'Meldingen' },
  'notifications.subtitle': { en: 'Latest updates from your workspace', nl: 'Laatste updates uit uw werkruimte' },
  'notifications.empty': { en: "You're all caught up!", nl: 'U bent helemaal bijgewerkt!' },
  'notifications.markAllRead': { en: 'Mark all as read', nl: 'Alles als gelezen markeren' },
  'notifications.clearAll': { en: 'Clear all', nl: 'Alles wissen' },
  'notifications.deleteAction': { en: 'Delete notification', nl: 'Melding verwijderen' },
  'notifications.openAction': { en: 'Open', nl: 'Openen' },
  'notifications.openAria': { en: 'Open notifications', nl: 'Meldingen openen' },
  'notifications.unreadAria': { en: 'Open notifications, {count} unread', nl: 'Meldingen openen, {count} ongelezen' },
};

const dutchOnlyOnboardingKeys = new Set([
  'onboarding.email.horizon3.subjectPrefix',
  'onboarding.email.horizon3.bodyTemplate',
]);

const onboardingTranslationMap: Record<string, Record<Language, string>> = Object.keys(
  onboardingTranslations.en,
).reduce((acc, key) => {
  const englishValue = onboardingTranslations.en[key] || key;
  const dutchValue = onboardingTranslations.nl[key] || englishValue;

  if (dutchOnlyOnboardingKeys.has(key)) {
    acc[key] = {
      en: dutchValue,
      nl: dutchValue,
    };
    return acc;
  }

  acc[key] = {
    en: englishValue,
    nl: dutchValue,
  };
  return acc;
}, {} as Record<string, Record<Language, string>>);

const translations: Record<string, Record<Language, string>> = {
  ...baseTranslations,
  ...onboardingTranslationMap,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('cores-lang');
    return (stored === 'nl' ? 'nl' : 'en') as Language;
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('cores-lang', lang);
  };

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};

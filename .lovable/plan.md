

# Cores HR — Internal HR Management Platform

## Overview
A clean, modern HR management app for a small company (max 25 employees), inspired by Personio/Linear. Built with React, Tailwind CSS, and local state/mock data (no backend initially). Supports English and Dutch with a language switcher.

## Brand & Design System
- **Font**: Montserrat Alternates from Google Fonts
- **Colors**: Teal-to-green gradient (#84e9e9 → #84e988) for sidebar/CTAs, dark navy (#284150) for text, orange (#ffbb6b) for warnings, light gray (#f8f8f8) background, white (#ffffff) cards
- **Style**: Rounded corners, minimal shadows, skeleton loaders, toast notifications

## Authentication
- Login page with Cores logo, Microsoft 365 SSO button (visual only), and email/password fallback
- Redirect to Dashboard after login
- Mock auth state stored in memory

## Navigation (Left Sidebar)
- Gradient background (teal → green), white logo at top
- Items: Dashboard, Employees, Onboarding, Provisioning, Settings
- Active item highlighted with white pill
- Collapsible to hamburger on mobile
- Language switcher (EN/NL) in top nav bar

## Pages

### 1. Dashboard
- 4 stat cards: Total employees, Active onboardings, Pending provisioning, Recently added
- "Recently added employees" table with name, department, start date, provisioning status badge
- "Onboarding progress" section with progress bars

### 2. Employees
- Full-width table: Avatar+Name, Department, Role, Start date, Work phone, Status badge, Actions (⋮ menu)
- Filter bar: Department dropdown, Status dropdown, Search input
- Status badges: Active (green), Inactive (gray), Onboarding (orange)
- Row click → Employee Profile page
- "Add new employee" gradient CTA button

### 2B. Employee Profile
- Left column: Avatar upload, name, role, department, status, quick stats
- Right column tabs: Details, Onboarding checklist, Provisioning status (M365 + Apple Business Manager with checkmarks/pending icons)

### 2C. Add Employee Form
- Modal with fields: First/Last name, Personal email, Role, Department (dropdown), Start date, Contract type, Work/Personal phone
- Info box about triggering provisioning on save
- Real-time validation

### 3. Onboarding
- List of active onboardings with progress bars, days since started
- Detail view: department-aware task checklist (shared mailboxes vary by department)
- Auto-completed tasks marked with lightning icon, manual tasks checkable by HR

### 4. Provisioning
- Table of provisioning jobs: Employee, Service, Status (Queued/Running/Completed/Failed), timestamps
- Status badges with colors, Failed rows have Retry button
- Detail drawer with step-by-step provisioning log

### 5. Settings
- Sections: Company info, Departments CRUD, Shared mailbox mapping, Provisioning defaults, Login PDF template config, Notification toggles

## Internationalization
- All UI text in English and Dutch using a context-based i18n system
- Language preference persisted to localStorage

## Data
- All data is mock/local state with realistic sample employees across Sales, Customs & Compliance, and Logistics departments
- No backend integration in v1


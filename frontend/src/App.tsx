import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { useAuthBootstrap } from "@/hooks/useAuthBootstrap"
import { RequireAuth, RequireStaff } from "@/routes/AuthGuard"
import ClientLayout from "@/layouts/ClientLayout"
import OpsLayout from "@/layouts/OpsLayout"

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"))
const SignupPage = lazy(() => import("@/pages/auth/SignupPage"))
const VerifyOtpPage = lazy(() => import("@/pages/auth/VerifyOtpPage"))

const DashboardPage = lazy(() => import("@/pages/app/DashboardPage"))
const CompliancePage = lazy(() => import("@/pages/app/CompliancePage"))
const MailPage = lazy(() => import("@/pages/app/MailPage"))
const MoneyPage = lazy(() => import("@/pages/app/MoneyPage"))
const ReferralsPage = lazy(() => import("@/pages/app/ReferralsPage"))
const NotificationsPage = lazy(() => import("@/pages/app/NotificationsPage"))
const PayInvoicePage = lazy(() => import("@/pages/public/PayInvoicePage"))
const SignPage = lazy(() => import("@/pages/public/SignPage"))
const CoFounderAcceptPage = lazy(() => import("@/pages/public/CoFounderAcceptPage"))
const StartPage = lazy(() => import("@/pages/onboarding/StartPage"))
const PaymentCallbackPage = lazy(() => import("@/pages/onboarding/PaymentCallbackPage"))

const QueuePage = lazy(() => import("@/pages/ops/QueuePage"))
const ServiceRequestsPage = lazy(() => import("@/pages/ops/ServiceRequestsPage"))
const MailRoomPage = lazy(() => import("@/pages/ops/MailRoomPage"))
const CasesPage = lazy(() => import("@/pages/ops/CasesPage"))
const CaseDetailPage = lazy(() => import("@/pages/ops/CaseDetailPage"))
const PaymentsPage = lazy(() => import("@/pages/ops/PaymentsPage"))
const ReportsPage = lazy(() => import("@/pages/ops/ReportsPage"))
const PartnersPage = lazy(() => import("@/pages/ops/PartnersPage"))
const SettingsPage = lazy(() => import("@/pages/ops/SettingsPage"))

function PageFallback() {
  return (
    <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">Loading…</div>
  )
}

export default function App() {
  const bootstrapped = useAuthBootstrap()

  if (!bootstrapped) {
    return <PageFallback />
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/pay/:token" element={<PayInvoicePage />} />
        <Route path="/sign/:token" element={<SignPage />} />
        <Route path="/cofounder/:token" element={<CoFounderAcceptPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/app" element={<ClientLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="start" element={<StartPage />} />
            <Route path="payment/callback" element={<PaymentCallbackPage />} />
            <Route path="compliance" element={<CompliancePage />} />
            <Route path="mail" element={<MailPage />} />
            <Route path="money" element={<MoneyPage />} />
            <Route path="referrals" element={<ReferralsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route element={<RequireStaff />}>
          <Route path="/ops" element={<OpsLayout />}>
            <Route index element={<Navigate to="/ops/queue" replace />} />
            <Route path="queue" element={<QueuePage />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="cases/:caseId" element={<CaseDetailPage />} />
            <Route path="service-requests" element={<ServiceRequestsPage />} />
            <Route path="mail-room" element={<MailRoomPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="partners" element={<PartnersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

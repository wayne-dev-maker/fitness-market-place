import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router'
import { EmptyState, LoadingState } from '../components/ui'
import LoginPage from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import CheckoutReturnPage from '../features/checkout/CheckoutReturnPage'
import MarketplacePage from '../features/marketplace/MarketplacePage'
import PlanDetailPage from '../features/marketplace/PlanDetailPage'
import ProgressPage from '../features/progress/ProgressPage'
import DashboardPage from '../features/workouts/DashboardPage'
import ProgrammePage from '../features/workouts/ProgrammePage'
import WorkoutPlayerPage from '../features/workouts/WorkoutPlayerPage'
import { useTitle } from '../hooks/useTitle'
import { USE_MOCK_API } from '../services/http'
import { Shell } from './Shell'

const TrainerDashboardPage = lazy(() => import('../features/trainer/TrainerDashboardPage'))
const PlanBuilderPage = lazy(() => import('../features/trainer/PlanBuilderPage'))
// The simulated payment page only exists in mock mode and is never part of a real build's routes.
const MockCheckoutPage = lazy(() => import('../features/checkout/MockCheckoutPage'))

function NotFoundPage() {
  useTitle('Page not found')
  return (
    <div className="page">
      <EmptyState title="Page not found" action={<Link className="btn btn-primary" to="/">Browse programmes</Link>}>
        The page you were looking for doesn’t exist or has moved.
      </EmptyState>
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      {USE_MOCK_API && (
        <Route
          path="mock-checkout"
          element={
            <Suspense fallback={<LoadingState />}>
              <MockCheckoutPage />
            </Suspense>
          }
        />
      )}
      <Route element={<Shell />}>
        <Route index element={<MarketplacePage />} />
        <Route path="plans/:planId" element={<PlanDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        <Route element={<RequireAuth />}>
          <Route path="checkout/return" element={<CheckoutReturnPage />} />
        </Route>

        <Route element={<RequireAuth role="TRAINEE" />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="programmes/:enrolmentId" element={<ProgrammePage />} />
          <Route path="workouts/:workoutId" element={<WorkoutPlayerPage />} />
          <Route path="progress" element={<ProgressPage />} />
        </Route>

        <Route element={<RequireAuth role="TRAINER" />}>
          <Route path="trainer" element={<TrainerDashboardPage />} />
          <Route path="trainer/plans/:planId" element={<PlanBuilderPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Dashboard } from '@/pages/dashboard'
import { Stores } from '@/pages/stores'
import { MarketplacePage } from '@/pages/stores/[marketplace]'
import { Login } from '@/pages/auth/login'
import { Register } from '@/pages/auth/register'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Stores />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores/:marketplace"
          element={
            <ProtectedRoute>
              <MainLayout>
                <MarketplacePage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <MainLayout>
                <div className="p-6">
                  <h1 className="text-3xl font-bold mb-4">Products</h1>
                  <p>Products page coming soon...</p>
                </div>
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <MainLayout>
                <div className="p-6">
                  <h1 className="text-3xl font-bold mb-4">Orders</h1>
                  <p>Orders page coming soon...</p>
                </div>
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <MainLayout>
                <div className="p-6">
                  <h1 className="text-3xl font-bold mb-4">Analytics</h1>
                  <p>Analytics page coming soon...</p>
                </div>
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/performance"
          element={
            <ProtectedRoute>
              <MainLayout>
                <div className="p-6">
                  <h1 className="text-3xl font-bold mb-4">Performance</h1>
                  <p>Performance page coming soon...</p>
                </div>
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <MainLayout>
                <div className="p-6">
                  <h1 className="text-3xl font-bold mb-4">Customers</h1>
                  <p>Customers page coming soon...</p>
                </div>
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <MainLayout>
                <div className="p-6">
                  <h1 className="text-3xl font-bold mb-4">Settings</h1>
                  <p>Settings page coming soon...</p>
                </div>
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  )
}

export default App
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { AdminLayout } from '@/components/layout/admin-layout'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { RequireSuperAdmin } from '@/components/auth/require-role'
import { Dashboard } from '@/pages/dashboard'
import { Stores } from '@/pages/stores'
import { Products } from '@/pages/products'
import { ProductDetail } from '@/pages/product-detail'
import { MarketplacePage } from '@/pages/stores/[marketplace]'
import { Login } from '@/pages/auth/login'
import { Register } from '@/pages/auth/register'
import { Account } from '@/pages/account'
import { Subscription } from '@/pages/subscription'
import { Usage } from '@/pages/usage'
import { Pricing } from '@/pages/pricing'
import { AdminDashboard } from '@/pages/admin/index'
import { AdminUsers } from '@/pages/admin/users'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
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
                <Products />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ProductDetail />
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
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Account />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Subscription />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/usage"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Usage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RequireSuperAdmin>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </RequireSuperAdmin>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <RequireSuperAdmin>
                <AdminLayout>
                  <AdminUsers />
                </AdminLayout>
              </RequireSuperAdmin>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute>
              <RequireSuperAdmin>
                <AdminLayout>
                  <div className="text-center py-10">
                    <h1 className="text-2xl font-bold">Analytics</h1>
                    <p className="text-muted-foreground">Detailed analytics coming soon...</p>
                  </div>
                </AdminLayout>
              </RequireSuperAdmin>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/subscriptions"
          element={
            <ProtectedRoute>
              <RequireSuperAdmin>
                <AdminLayout>
                  <div className="text-center py-10">
                    <h1 className="text-2xl font-bold">Subscriptions</h1>
                    <p className="text-muted-foreground">Subscription management coming soon...</p>
                  </div>
                </AdminLayout>
              </RequireSuperAdmin>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/system"
          element={
            <ProtectedRoute>
              <RequireSuperAdmin>
                <AdminLayout>
                  <div className="text-center py-10">
                    <h1 className="text-2xl font-bold">System</h1>
                    <p className="text-muted-foreground">System monitoring coming soon...</p>
                  </div>
                </AdminLayout>
              </RequireSuperAdmin>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute>
              <RequireSuperAdmin>
                <AdminLayout>
                  <div className="text-center py-10">
                    <h1 className="text-2xl font-bold">Admin Settings</h1>
                    <p className="text-muted-foreground">Platform settings coming soon...</p>
                  </div>
                </AdminLayout>
              </RequireSuperAdmin>
            </ProtectedRoute>
          }
        />
        
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  )
}

export default App
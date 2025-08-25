import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { AdminLayout } from '@/components/layout/admin-layout'
import { WorkspaceProvider } from '@/components/workspace/workspace-context'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { RequireSuperAdmin } from '@/components/auth/require-role'
import { RequireSubscription } from '@/components/auth/require-subscription'
import { SmartRedirect } from '@/components/auth/smart-redirect'
import { SubscriptionRedirect } from '@/components/auth/subscription-redirect'
import { Dashboard } from '@/pages/dashboard'
import { Stores } from '@/pages/stores'
import { Products } from '@/pages/products'
import { ProductDetail } from '@/pages/product-detail'
import { MarketplacePage } from '@/pages/stores/[marketplace]'
import { Login } from '@/pages/auth/login'
import { Register } from '@/pages/auth/register'
import { Account } from '@/pages/account'
import { Subscription } from '@/pages/subscription'
import WorkspaceSubscriptionPage from '@/pages/workspace-subscription'
import { Usage } from '@/pages/usage'
import { Pricing } from '@/pages/pricing'
import { InternalPricing } from '@/pages/internal-pricing'
import { DemoCheckout } from '@/pages/demo-checkout'
import { AdminDashboard } from '@/pages/admin/index'
import { AdminUsers } from '@/pages/admin/users'
import { AdminSubscriptions } from '@/pages/admin/subscriptions'
import Workspaces from '@/pages/workspaces'

function App() {
  return (
    <Router>
      <WorkspaceProvider>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/demo-checkout" element={<DemoCheckout />} />
        
        {/* Internal pricing page for authenticated users without subscription */}
        <Route
          path="/pricing-internal"
          element={
            <ProtectedRoute>
              <MainLayout>
                <InternalPricing />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <Stores />
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores/:marketplace"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <MarketplacePage />
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <Products />
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:id"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <ProductDetail />
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <div className="p-6">
                    <h1 className="text-3xl font-bold mb-4">Orders</h1>
                    <p>Orders page coming soon...</p>
                  </div>
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <div className="p-6">
                    <h1 className="text-3xl font-bold mb-4">Analytics</h1>
                    <p>Analytics page coming soon...</p>
                  </div>
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/performance"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <div className="p-6">
                    <h1 className="text-3xl font-bold mb-4">Performance</h1>
                    <p>Performance page coming soon...</p>
                  </div>
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <div className="p-6">
                    <h1 className="text-3xl font-bold mb-4">Customers</h1>
                    <p>Customers page coming soon...</p>
                  </div>
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <div className="p-6">
                    <h1 className="text-3xl font-bold mb-4">Settings</h1>
                    <p>Settings page coming soon...</p>
                  </div>
                </MainLayout>
              </RequireSubscription>
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
        {/* Subscription management for users WITH active subscription */}
        <Route
          path="/subscription-manage"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <WorkspaceSubscriptionPage />
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        
        {/* Legacy subscription route - redirect to appropriate page */}
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <SubscriptionRedirect>
                <></>
              </SubscriptionRedirect>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription-legacy"
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
        <Route
          path="/workspaces"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Workspaces />
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
                  <AdminSubscriptions />
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
        
        <Route path="/" element={<SmartRedirect />} />
        </Routes>
      </WorkspaceProvider>
    </Router>
  )
}

export default App
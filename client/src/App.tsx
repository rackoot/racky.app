import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { AdminLayout } from '@/components/layout/admin-layout'
import { WorkspaceProvider } from '@/components/workspace/workspace-context'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { RequireSuperAdmin } from '@/components/auth/require-role'
import { RequireSubscription } from '@/components/auth/require-subscription'
import { SmartRedirect } from '@/components/auth/smart-redirect'
import { Dashboard } from '@/pages/dashboard'
import { Stores } from '@/pages/stores'
import { Products } from '@/pages/products'
import { ProductDetail } from '@/pages/product-detail'
// import { Videos } from '@/pages/videos'
// import { GenerateVideo } from '@/pages/videos/generate'
import { NotFound } from '@/pages/not-found'
import { MarketplacePage } from '@/pages/stores/[marketplace]'
import { Login } from '@/pages/auth/login'
import { Register } from '@/pages/auth/register'
import { Account } from '@/pages/account'
import { Orders } from '@/pages/orders'
import { Customers } from '@/pages/customers'
import WorkspaceSubscriptionPage from '@/pages/workspace-subscription'
import { Usage } from '@/pages/usage'
import { Pricing } from '@/pages/pricing'
import { PurchaseSuccess } from '@/pages/purchase-success'
import { DemoCheckout } from '@/pages/demo-checkout'
import { AdminDashboard } from '@/pages/admin/index'
import { AdminUsers } from '@/pages/admin/users'
import { AdminWorkspaces } from '@/pages/admin/workspaces'
import { AdminSubscriptions } from '@/pages/admin/subscriptions'
import { AdminAnalytics } from '@/pages/admin/analytics'
import { ApiDocsPage } from '@/pages/admin/api-docs'
import Workspaces from '@/pages/workspaces'
import AIOpportunitiesPage from '@/pages/ai-optimization/opportunities'
import AIStartScanPage from '@/pages/ai-optimization/start-scan'
import AIScanHistoryPage from '@/pages/ai-optimization/scan-history'
import { AIScanResultsPage } from '@/pages/ai-scan-results'

function App() {
  return (
    <Router>
      <WorkspaceProvider>
        <Routes>
        {/* Auth routes */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        
        {/* Legacy redirects */}
        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/register" element={<Navigate to="/auth/register" replace />} />
        <Route path="/demo-checkout" element={<DemoCheckout />} />
        
        {/* Pricing page for authenticated users without subscription */}
        <Route
          path="/pricing"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Pricing />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        {/* Purchase success page - shown after successful Stripe checkout */}
        <Route
          path="/purchase-success"
          element={
            <ProtectedRoute>
              <PurchaseSuccess />
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
        {/* Videos routes temporarily disabled - return 404 */}
        <Route
          path="/videos"
          element={<NotFound />}
        />
        <Route
          path="/videos/generate"
          element={<NotFound />}
        />
        {/* Original videos routes - kept for future use
        <Route
          path="/videos"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <Videos />
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/videos/generate"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <GenerateVideo />
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        */}
        <Route
          path="/ai-optimization"
          element={<Navigate to="/ai-optimization/opportunities" replace />}
        />
        <Route
          path="/ai-optimization/opportunities"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <AIOpportunitiesPage />
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-optimization/start-scan"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <AIStartScanPage />
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-optimization/scan-history"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <AIScanHistoryPage />
                </MainLayout>
              </RequireSubscription>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-optimization/results/:jobId"
          element={
            <ProtectedRoute>
              <RequireSubscription>
                <MainLayout>
                  <AIScanResultsPage />
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
                  <Orders />
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
                  <Customers />
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
          path="/admin/workspaces"
          element={
            <ProtectedRoute>
              <RequireSuperAdmin>
                <AdminLayout>
                  <AdminWorkspaces />
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
                  <AdminAnalytics />
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
          path="/admin/api-docs"
          element={
            <ProtectedRoute>
              <RequireSuperAdmin>
                <AdminLayout>
                  <ApiDocsPage />
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
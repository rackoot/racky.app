import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  // Mock authentication - this would need to be adjusted based on your auth implementation
  test.beforeEach(async ({ page }) => {
    // Mock authentication by setting localStorage or cookies
    // This is a simplified example - you'd implement proper test authentication
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'mock-test-token')
      localStorage.setItem('user', JSON.stringify({
        _id: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER'
      }))
    })
  })

  test('should display dashboard when authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Should show dashboard content
    await expect(page.getByText('Dashboard')).toBeVisible()
    
    // Should show key metrics or components
    await expect(page.getByText('Total Products')).toBeVisible()
    await expect(page.getByText('Connected Stores')).toBeVisible()
    await expect(page.getByText('Active Marketplaces')).toBeVisible()
  })

  test('should show workspace selector', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Should show workspace selector
    const workspaceSelector = page.getByTestId('workspace-selector')
    await expect(workspaceSelector).toBeVisible()
  })

  test('should navigate to stores page', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Click on stores link/button
    await page.getByText('Stores').click()
    
    // Should navigate to stores page
    await expect(page).toHaveURL(/.*\/stores/)
  })

  test('should navigate to products page', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Click on products link/button
    await page.getByText('Products').click()
    
    // Should navigate to products page
    await expect(page).toHaveURL(/.*\/products/)
  })

  test('should show sidebar navigation', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Should show sidebar with navigation items
    await expect(page.getByText('Dashboard')).toBeVisible()
    await expect(page.getByText('Products')).toBeVisible()
    await expect(page.getByText('Stores')).toBeVisible()
    await expect(page.getByText('Marketplaces')).toBeVisible()
  })

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')
    
    // On mobile, sidebar might be collapsed or hidden
    // This would depend on your responsive implementation
    
    // Should still show main content
    await expect(page.getByText('Dashboard')).toBeVisible()
    
    // Check for mobile menu button if implemented
    const menuButton = page.getByRole('button', { name: /menu/i })
    if (await menuButton.isVisible()) {
      await menuButton.click()
      // Should show navigation
      await expect(page.getByText('Products')).toBeVisible()
    }
  })

  test('should handle user profile dropdown', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Click on user profile area
    const userProfile = page.getByTestId('user-profile')
    if (await userProfile.isVisible()) {
      await userProfile.click()
      
      // Should show dropdown with options
      await expect(page.getByText('Account Settings')).toBeVisible()
      await expect(page.getByText('Sign Out')).toBeVisible()
    }
  })

  test('should display loading states', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Should show some kind of loading indicator initially
    // This depends on your implementation
    
    // Wait for content to load
    await expect(page.getByText('Dashboard')).toBeVisible()
  })

  test('should handle empty states', async ({ page }) => {
    // Mock empty data state
    await page.route('**/api/dashboard/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalProducts: 0,
            connectedStores: 0,
            activeMarketplaces: 0
          }
        })
      })
    })
    
    await page.goto('/dashboard')
    
    // Should show empty states or zero values
    await expect(page.getByText('0')).toBeVisible()
    
    // Might show getting started messages
    const gettingStartedText = page.getByText(/get started/i)
    if (await gettingStartedText.isVisible()) {
      expect(gettingStartedText).toBeVisible()
    }
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/dashboard/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Internal server error'
        })
      })
    })
    
    await page.goto('/dashboard')
    
    // Should show error state or fallback content
    // This depends on your error handling implementation
    const errorMessage = page.getByText(/error/i).or(page.getByText(/something went wrong/i))
    if (await errorMessage.isVisible()) {
      expect(errorMessage).toBeVisible()
    }
  })

  test('should maintain scroll position on navigation', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Scroll down if there's scrollable content
    await page.mouse.wheel(0, 500)
    
    // Navigate away and back
    await page.getByText('Products').click()
    await page.waitForURL(/.*\/products/)
    
    await page.goBack()
    
    // Dashboard should be visible again
    await expect(page.getByText('Dashboard')).toBeVisible()
  })
})
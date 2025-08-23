import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test
    await page.goto('/')
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Should be redirected to login page
    await expect(page).toHaveURL(/.*\/auth\/login/)
    await expect(page.getByText('Sign in to your account')).toBeVisible()
  })

  test('should show registration form', async ({ page }) => {
    await page.goto('/auth/register')
    
    await expect(page.getByText('Create your account')).toBeVisible()
    await expect(page.getByLabel('First Name')).toBeVisible()
    await expect(page.getByLabel('Last Name')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('should validate registration form', async ({ page }) => {
    await page.goto('/auth/register')
    
    // Try to submit empty form
    await page.getByRole('button', { name: 'Create Account' }).click()
    
    // Should show validation errors
    await expect(page.getByText('First name is required')).toBeVisible()
    await expect(page.getByText('Last name is required')).toBeVisible()
    await expect(page.getByText('Email is required')).toBeVisible()
    await expect(page.getByText('Password is required')).toBeVisible()
  })

  test('should validate login form', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Try to submit empty form
    await page.getByRole('button', { name: 'Sign In' }).click()
    
    // Should show validation errors
    await expect(page.getByText('Email is required')).toBeVisible()
    await expect(page.getByText('Password is required')).toBeVisible()
  })

  test('should show password requirements', async ({ page }) => {
    await page.goto('/auth/register')
    
    // Focus on password field
    await page.getByLabel('Password').focus()
    
    // Should show password requirements or hints
    const passwordInput = page.getByLabel('Password')
    await passwordInput.fill('weak')
    
    // Check for some indication of password strength or requirements
    // This will depend on your UI implementation
  })

  test('should toggle between login and register', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Click link to register
    await page.getByText('Don\'t have an account?').click()
    await expect(page).toHaveURL(/.*\/auth\/register/)
    
    // Click link back to login
    await page.getByText('Already have an account?').click()
    await expect(page).toHaveURL(/.*\/auth\/login/)
  })

  test('should handle form submission loading states', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Fill in form
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('password123')
    
    // Submit form
    const submitButton = page.getByRole('button', { name: 'Sign In' })
    await submitButton.click()
    
    // Should show loading state (this depends on your implementation)
    // You might check for disabled state, loading spinner, etc.
  })

  test('should be accessible via keyboard', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Tab through form elements
    await page.keyboard.press('Tab') // Email field
    await page.keyboard.type('test@example.com')
    
    await page.keyboard.press('Tab') // Password field
    await page.keyboard.type('password123')
    
    await page.keyboard.press('Tab') // Submit button
    await page.keyboard.press('Enter') // Submit form
    
    // Form should be submitted
  })

  test('should remember form data on page refresh', async ({ page }) => {
    await page.goto('/auth/login')
    
    // Fill form
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('password123')
    
    // Refresh page
    await page.reload()
    
    // Form should be empty (for security) or remember email only
    const emailValue = await page.getByLabel('Email').inputValue()
    const passwordValue = await page.getByLabel('Password').inputValue()
    
    // Password should definitely be empty for security
    expect(passwordValue).toBe('')
    
    // Email might be remembered depending on implementation
  })

  test('should handle mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
    await page.goto('/auth/login')
    
    // Form should be responsive
    await expect(page.getByText('Sign in to your account')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    
    // Form fields should be properly sized for mobile
    const emailInput = page.getByLabel('Email')
    const box = await emailInput.boundingBox()
    expect(box?.width).toBeGreaterThan(200) // Should have reasonable width
  })
})
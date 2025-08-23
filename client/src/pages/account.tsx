import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCurrentUser } from "@/lib/auth"
import { getAuthHeaders } from "@/lib/utils"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export function Account() {
  const user = getCurrentUser()
  const navigate = useNavigate()
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || ''
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  
  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <Card>
          <CardContent className="pt-6">
            <p>Please log in to view account settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)
    setProfileError('')
    setProfileSuccess('')

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(profileData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Update localStorage with new user data
        localStorage.setItem('user', JSON.stringify(data.data))
        setProfileSuccess('Profile updated successfully!')
        // Refresh the page or update UI as needed
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        setProfileError(data.message || 'Failed to update profile')
      }
    } catch (error) {
      setProfileError('Network error. Please try again.')
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordLoading(true)
    setPasswordError('')
    setPasswordSuccess('')

    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match')
      setPasswordLoading(false)
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      setPasswordLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setPasswordSuccess('Password updated successfully!')
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        setPasswordError(data.message || 'Failed to update password')
      }
    } catch (error) {
      setPasswordError('Network error. Please try again.')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your account information and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal information and email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            {profileError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {profileSuccess}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input 
                  id="firstName" 
                  value={profileData.firstName} 
                  onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Enter your first name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input 
                  id="lastName" 
                  value={profileData.lastName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Enter your last name"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                value={profileData.email}
                onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter your email address"
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={profileLoading}>
                {profileLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Manage your password and security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            {passwordError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {passwordSuccess}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input 
                id="currentPassword" 
                type="password" 
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Enter your current password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input 
                id="newPassword" 
                type="password" 
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Enter your new password"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm your new password"
                minLength={6}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={passwordLoading}>
                {passwordLoading ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
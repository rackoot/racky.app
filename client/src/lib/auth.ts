export interface User {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
}

export function getCurrentUser(): User | null {
  try {
    const userStr = localStorage.getItem('user')
    if (!userStr) return null
    
    const userData = JSON.parse(userStr)
    return userData.user || userData // Handle different response formats
  } catch {
    return null
  }
}

export function getUserDisplayName(user: User): string {
  if (user.name) return user.name
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`
  if (user.firstName) return user.firstName
  return user.email
}

export function getUserInitials(user: User): string {
  const displayName = getUserDisplayName(user)
  
  // If we have a proper name (not email), get initials from that
  if (displayName !== user.email) {
    const nameParts = displayName.split(' ')
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
    }
    return displayName.slice(0, 2).toUpperCase()
  }
  
  // For email, take first letter and first letter after @ or second letter
  const emailParts = user.email.split('@')
  const username = emailParts[0]
  if (username.length >= 2) {
    return `${username[0]}${username[1]}`.toUpperCase()
  }
  return username[0].toUpperCase() + (emailParts[1] ? emailParts[1][0].toUpperCase() : 'U')
}

export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  window.location.href = '/login'
}

export function getRandomColorForUser(user: User): string {
  // Generate a consistent color based on user email
  const colors = [
    'bg-blue-500',
    'bg-green-500', 
    'bg-purple-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-teal-500'
  ]
  
  // Simple hash function for consistent color
  let hash = 0
  for (let i = 0; i < user.email.length; i++) {
    hash = user.email.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colors[Math.abs(hash) % colors.length]
}
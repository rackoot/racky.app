// Auth request types
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
}

// Auth response types
export interface AuthResponse {
  token: string
  user: {
    _id: string
    email: string
    firstName?: string
    lastName?: string
    name?: string
    role: 'USER' | 'SUPERADMIN'
  }
}

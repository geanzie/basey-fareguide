'use client'

import { useState } from 'react'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'

interface AuthPageProps {
  initialError?: string
  initialUsername?: string
}

const AuthPage = ({ initialError = '', initialUsername = '' }: AuthPageProps) => {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div>
      {isLogin ? (
        <LoginForm
          initialError={initialError}
          initialUsername={initialUsername}
          onSwitchToRegister={() => setIsLogin(false)}
        />
      ) : (
        <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
      )}
    </div>
  )
}

export default AuthPage
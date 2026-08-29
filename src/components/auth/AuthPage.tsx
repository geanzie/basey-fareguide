'use client'

import { useState } from 'react'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'
import type { SocialProviderOption } from './SocialSignInButtons'

interface AuthPageProps {
  initialError?: string
  initialUsername?: string
  /** Social providers the server has credentials for. */
  socialProviders?: SocialProviderOption[]
}

const AuthPage = ({
  initialError = '',
  initialUsername = '',
  socialProviders = [],
}: AuthPageProps) => {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div>
      {isLogin ? (
        <LoginForm
          initialError={initialError}
          initialUsername={initialUsername}
          socialProviders={socialProviders}
          onSwitchToRegister={() => setIsLogin(false)}
        />
      ) : (
        <RegisterForm socialProviders={socialProviders} onSwitchToLogin={() => setIsLogin(true)} />
      )}
    </div>
  )
}

export default AuthPage

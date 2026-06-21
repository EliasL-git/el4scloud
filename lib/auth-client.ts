'use client'

import { createAuthClient } from 'better-auth/react'
import { genericOAuthClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
  fetchOptions: {
    credentials: 'include',
  },
})

export const { signIn, signOut, useSession } = authClient

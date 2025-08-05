import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'

export function meta() {
  return [
    { title: "Authentication - Minecash" },
    { name: "description", content: "Completing authentication..." },
  ]
}

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the URL hash that contains auth tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        
        if (accessToken) {
          // Set the session with the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          })
          
          if (error) {
            console.error('Error setting session:', error)
            navigate('/?error=auth_failed')
            return
          }
          
          if (data.session) {
            console.log('Authentication successful!')
            
            // Ensure user exists in users table and has GC balance
            await ensureUserExists(data.session.user)
            
            // Sync Discord ID to users table if it's a Discord login
            if (data.session.user.app_metadata.provider === 'discord') {
              const discordId = data.session.user.user_metadata.sub || data.session.user.user_metadata.provider_id
              const discordUsername = data.session.user.user_metadata.full_name || data.session.user.user_metadata.name
              
              if (discordId) {
                try {
                  const { error: updateError } = await supabase
                    .from('users')
                    .update({ 
                      discord_id: discordId,
                      username: discordUsername || data.session.user.email?.split('@')[0] || 'Unknown'
                    })
                    .eq('auth_user_id', data.session.user.id)
                  
                  if (updateError) {
                    console.error('Error updating Discord data:', updateError)
                  } else {
                    console.log('Discord data synced to users table')
                  }
                } catch (error) {
                  console.error('Error syncing Discord data:', error)
                }
              }
            }
            
            navigate('/')
            return
          }
        }
        
        // Fallback: try to get existing session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Error getting session:', sessionError)
          navigate('/?error=auth_failed')
          return
        }

        if (sessionData.session) {
          // Ensure user exists in users table and has GC balance
          await ensureUserExists(sessionData.session.user)
          navigate('/')
        } else {
          navigate('/?error=no_session')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        navigate('/?error=auth_failed')
      }
    }

    // Function to ensure user exists in users table and has GC balance
    const ensureUserExists = async (user: any) => {
      try {
        // First, check if user exists in users table
        const { data: existingUser, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single()

        let userId: number

        if (userError || !existingUser) {
          // User doesn't exist, create them
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              auth_user_id: user.id,
              email: user.email,
              username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown',
              avatar_url: user.user_metadata?.avatar_url,
              role_id: 1 // Default user role
            })
            .select('id')
            .single()

          if (createError) {
            console.error('Error creating user:', createError)
            return
          }

          userId = newUser.id
          console.log('New user created with ID:', userId)
        } else {
          userId = existingUser.id
        }

        // Now ensure user has a GC balance entry
        const { data: existingBalance, error: balanceError } = await supabase
          .from('gc_balances')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (balanceError || !existingBalance) {
          // User doesn't have GC balance, create it with default 0 GC
          const { error: balanceCreateError } = await supabase
            .from('gc_balances')
            .insert({
              user_id: userId,
              balance: 0 // Default starting balance
            })

          if (balanceCreateError) {
            console.error('Error creating GC balance:', balanceCreateError)
          } else {
            console.log('GC balance created for user:', userId)
          }
        }
      } catch (error) {
        console.error('Error ensuring user exists:', error)
      }
    }

    handleAuthCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
        <p className="text-xl">Completing authentication...</p>
        <p className="text-gray-400 mt-2">Please wait while we sign you in</p>
      </div>
    </div>
  )
} 
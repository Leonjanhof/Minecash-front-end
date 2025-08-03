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
          navigate('/')
        } else {
          navigate('/?error=no_session')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        navigate('/?error=auth_failed')
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
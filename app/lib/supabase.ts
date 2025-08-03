import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Environment variables - fallback to hardcoded values for development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://avpgfvdloupgfckpqxuq.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cGdmdmRsb3VwZ2Zja3BxeHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzODkyMTIsImV4cCI6MjA2ODk2NTIxMn0.7x-eDvqxYUdeI9_SIGwBItsi6HWVwoTuYTL1rybV7yA'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// GC Balance helper functions
export const gcBalanceHelpers = {
  // Get user's current GC balance
  async getUserBalance(userId: number): Promise<number> {
    const { data, error } = await supabase
      .rpc('get_user_gc_balance', { p_user_id: userId })
    
    if (error) {
      console.error('Error fetching user balance:', error)
      return 0
    }
    
    return data || 0
  },

  // Update user's GC balance (for games, deposits, withdrawals)
  async updateBalance(
    userId: number,
    amount: number,
    transactionType: 'deposit' | 'withdrawal' | 'game_win' | 'game_loss' | 'bonus' | 'refund',
    gameType?: string,
    gameId?: string,
    description?: string
  ): Promise<number> {
    const { data, error } = await supabase
      .rpc('update_gc_balance', {
        p_user_id: userId,
        p_amount: amount,
        p_transaction_type: transactionType,
        p_game_type: gameType,
        p_game_id: gameId,
        p_description: description
      })
    
    if (error) {
      console.error('Error updating balance:', error)
      throw new Error('Failed to update balance')
    }
    
    return data
  },

  // Get user's transaction history
  async getUserTransactions(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ) {
    const { data, error } = await supabase
      .rpc('get_user_transactions', {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset
      })
    
    if (error) {
      console.error('Error fetching transactions:', error)
      return []
    }
    
    return data || []
  },

  // Subscribe to real-time balance updates
  subscribeToBalance(userId: number, callback: (balance: number) => void) {
    return supabase
      .channel(`gc_balance_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gc_balances',
          filter: `user_id=eq.${userId}`
        },
        (payload: any) => {
          const newBalance = payload.new?.balance || 0
          callback(newBalance)
        }
      )
      .subscribe()
  }
}

// Review helper functions
export const reviewHelpers = {
  // Get all reviews for display
  async getReviews(limit: number = 10) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching reviews:', error)
      return []
    }
    
    return data || []
  },

  // Check if user has already submitted a review
  async hasUserReviewed(authUserId: string) {
    // First get the user's ID from the users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .single()
    
    if (userError || !userData) {
      return false
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', userData.id)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking user review:', error)
      return false
    }
    
    return !!data
  },

  // Subscribe to real-time review updates
  subscribeToReviews(callback: (reviews: any[]) => void) {
    return supabase
      .channel('reviews')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews'
        },
        async () => {
          // Refetch reviews when there are changes
          const reviews = await reviewHelpers.getReviews()
          callback(reviews)
        }
      )
      .subscribe()
  }
}

// Gamemode access helper functions
export const gamemodeAccessHelpers = {
  // Check if a gamemode is disabled for users
  async isGamemodeDisabled(gamemode: string): Promise<boolean> {
    console.log(`Checking if gamemode ${gamemode} is disabled`);
    const { data, error } = await supabase
      .from('gamemode_access_restrictions')
      .select('is_disabled')
      .eq('gamemode', gamemode)
      .single()
    
    if (error) {
      console.error('Error checking gamemode access:', error)
      return false // Default to enabled if error
    }
    
    console.log(`Database result for ${gamemode}:`, data);
    const result = data?.is_disabled || false;
    console.log(`Final result for ${gamemode}:`, result);
    return result
  },

  // Get all gamemode restrictions
  async getGamemodeRestrictions() {
    const { data, error } = await supabase
      .from('gamemode_access_restrictions')
      .select('*')
      .order('gamemode')
    
    if (error) {
      console.error('Error fetching gamemode restrictions:', error)
      return []
    }
    
    return data || []
  },

  // Subscribe to gamemode restriction changes
  subscribeToGamemodeRestrictions(callback: (restrictions: any[]) => void) {
    return supabase
      .channel('gamemode_restrictions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gamemode_access_restrictions'
        },
        async () => {
          // Refetch restrictions when there are changes
          const restrictions = await gamemodeAccessHelpers.getGamemodeRestrictions()
          callback(restrictions)
        }
      )
      .subscribe()
  }
}

// User statistics helper functions
export const userStatsHelpers = {
  // Get user statistics for crash game
  async getCrashStats(userId: number) {
    const { data, error } = await supabase
      .from('crash_bets')
      .select(`
        id,
        bet_amount,
        payout_amount,
        status,
        cashout_multiplier,
        created_at
      `)
      .eq('user_id', userId)
    
    if (error) {
      console.error('Error fetching crash stats:', error)
      return null
    }

    if (!data || data.length === 0) {
      return null
    }

    const totalGames = data.length
    const gamesWon = data.filter(bet => bet.status === 'cashed_out').length
    const gamesLost = data.filter(bet => bet.status === 'crashed').length
    const gcWon = data
      .filter(bet => bet.payout_amount && bet.payout_amount > 0)
      .reduce((sum, bet) => sum + Number(bet.payout_amount), 0)
    const gcLost = data
      .filter(bet => bet.bet_amount)
      .reduce((sum, bet) => sum + Number(bet.bet_amount), 0)

    return {
      totalGames,
      gamesWon,
      gamesLost,
      gcWon,
      gcLost
    }
  },

  // Get all user statistics for games with backend data
  async getUserStats(userId: number) {
    const crashStats = await userStatsHelpers.getCrashStats(userId)
    
    return {
      crash: crashStats,
      // Other games will be null since they don't have backend data yet
      blackjack: null,
      roulette: null,
      slots: null,
      'hi-lo': null
    }
  }
}

// Crash rounds helper functions
export const crashRoundsHelpers = {
  // Get the last crash rounds
  async getLastRounds(limit = 20) {
    const { data, error } = await supabase
      .from('crash_rounds')
      .select('round_number, crash_multiplier')
      .eq('phase', 'completed')
      .order('round_number', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching last rounds:', error)
      return []
    }

    // Reverse to get chronological order (oldest to newest, left to right)
    return data ? data.reverse().map(round => ({
      multiplier: Number(round.crash_multiplier),
      roundNumber: round.round_number
    })) : []
  }
}

export default supabase

// Types for our database
export interface UserProfile {
  id: number
  auth_user_id: string
  email: string
  username: string | null
  avatar_url: string | null
  role_id: number
  created_at: string
  updated_at: string
  user_roles?: {
    id: number
    name: string
    description: string | null
  }
}

export interface UserRole {
  id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Review {
  id: number
  user_id: number
  username: string
  rating: number
  description: string
  created_at: string
  updated_at: string
} 
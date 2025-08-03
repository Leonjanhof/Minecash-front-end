import type { Route } from "./+types/admin";
import { useAuth } from "../contexts/AuthContext";
import { GoldButton, LightButton } from "../components/Button";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { supabase, gcBalanceHelpers, gamemodeAccessHelpers } from "../lib/supabase";
import { backendApi } from "../lib/backend-api";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Admin Dashboard - MINECASH" },
    { name: "description", content: "Admin dashboard for managing MINECASH platform." },
  ];
}

interface User {
  id: number;
  username: string | null;
  email: string;
  discord_id: string | null;
  banned: boolean;
  created_at: string;
  gc_balance?: number;
  displayName?: string;
}

interface UserStats {
  total_bets: number;
  total_won: number;
  total_lost: number;
  net_profit: number;
  games_played: number;
  biggest_win: number;
  biggest_loss: number;
}

interface GamemodeStats {
  gamemode: string;
  icon: string;
  uptime: number;
  playersOnline: number;
  houseProfit: number;
  houseExpense: number;
  totalBets?: number;
  wins?: number;
  losses?: number;
  avgMultiplier?: number;
  isActive: boolean;
}

const gamemodeStats: GamemodeStats[] = [
  { 
    gamemode: "Crash", 
    icon: "", 
    uptime: 99.7, 
    playersOnline: 0, 
    houseProfit: 133.50, 
    houseExpense: 0,
    totalBets: 23,
    wins: 4,
    losses: 19,
    avgMultiplier: 1.41,
    isActive: true
  },
  { 
    gamemode: "Blackjack", 
    icon: "", 
    uptime: 0, 
    playersOnline: 0, 
    houseProfit: 0, 
    houseExpense: 0,
    isActive: false
  },
  { 
    gamemode: "Roulette", 
    icon: "", 
    uptime: 0, 
    playersOnline: 0, 
    houseProfit: 0, 
    houseExpense: 0,
    isActive: false
  },
  { 
    gamemode: "Slots", 
    icon: "", 
    uptime: 0, 
    playersOnline: 0, 
    houseProfit: 0, 
    houseExpense: 0,
    isActive: false
  },
  { 
    gamemode: "Hi-Lo", 
    icon: "", 
    uptime: 0, 
    playersOnline: 0, 
    houseProfit: 0, 
    houseExpense: 0,
    isActive: false
  },
];

const adminLogs = [
  { timestamp: "2024-01-15 14:32", action: "User banned", details: "SpamBot banned for spam", admin: "AdminUser" },
  { timestamp: "2024-01-15 14:28", action: "GC adjustment", details: "Manual GC adjustment: +500 to HighRoller", admin: "AdminUser" },
  { timestamp: "2024-01-15 14:15", action: "Rate change", details: "Blackjack RTP changed from 98.0% to 98.5%", admin: "AdminUser" },
  { timestamp: "2024-01-15 13:45", action: "Ticket response", details: "Support ticket #123 resolved", admin: "AdminUser" },
];

export default function Admin() {
  const { user, loading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [gcAdjustments, setGcAdjustments] = useState<{ [key: number]: number }>({});
  const [totalGCCirculation, setTotalGCCirculation] = useState(0);
  const [gcStats, setGcStats] = useState({
    totalCirculation: 0,
    totalDeposits: 0,
    totalWithdrawals: 0
  });
  const [adminLogs, setAdminLogs] = useState<Array<{
    id: number;
    message: string;
    level: string;
    details: any;
    timestamp: string;
    source: string;
  }>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [gamemodeRestrictions, setGamemodeRestrictions] = useState<Array<{
    id: number;
    gamemode: string;
    is_disabled: boolean;
    disabled_at: string | null;
    disabled_by: number | null;
    reason: string | null;
  }>>([]);
  const [loadingRestrictions, setLoadingRestrictions] = useState(false);
  const [updatingGamemode, setUpdatingGamemode] = useState<string | null>(null);
  const [emergencyStopping, setEmergencyStopping] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // Fetch users on component mount
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchTotalGCCirculation();
      fetchAdminLogs();
      fetchGamemodeRestrictions();
    }
  }, [isAdmin]);

  const fetchGamemodeRestrictions = async () => {
    try {
      setLoadingRestrictions(true);
      const data = await gamemodeAccessHelpers.getGamemodeRestrictions();
      setGamemodeRestrictions(data);
    } catch (error) {
      console.error('Error fetching gamemode restrictions:', error);
    } finally {
      setLoadingRestrictions(false);
    }
  };

  const toggleGamemodeAccess = async (gamemode: string, isDisabled: boolean, reason?: string) => {
    try {
      setUpdatingGamemode(gamemode);
      
      // Get the current user's ID from the users table
      let adminUserId = null;
      if (isDisabled && user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();

        if (userError) {
          console.error('Error getting admin user ID:', userError);
        } else {
          adminUserId = userData?.id;
        }
      }

      console.log('Updating gamemode restriction:', { gamemode, isDisabled, adminUserId });
      
      const { error } = await supabase
        .from('gamemode_access_restrictions')
        .update({
          is_disabled: isDisabled,
          disabled_at: isDisabled ? new Date().toISOString() : null,
          disabled_by: adminUserId,
          reason: reason || null,
          updated_at: new Date().toISOString()
        })
        .eq('gamemode', gamemode);

      if (error) {
        console.error('Error updating gamemode restriction:', error);
        return;
      }

      console.log('Successfully updated gamemode restriction');

      // Refresh the restrictions
      await fetchGamemodeRestrictions();

      // Log the action
      const { error: logError } = await supabase
        .from('admin_logs')
        .insert({
          message: `Gamemode ${gamemode} ${isDisabled ? 'disabled' : 'enabled'} for users`,
          level: 'info',
          details: { gamemode, is_disabled: isDisabled, reason },
          source: 'admin_panel'
        });

      if (logError) {
        console.error('Error logging admin action:', logError);
      }

      // Show success feedback
      console.log(`Successfully ${isDisabled ? 'disabled' : 'enabled'} ${gamemode} gamemode`);
    } catch (error) {
      console.error('Error toggling gamemode access:', error);
    } finally {
      setUpdatingGamemode(null);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      setEmergencyStopping(true);
      setShowEmergencyModal(false);
      
      // Call the emergency stop API using the backend client
      const result = await backendApi.emergencyStop();
      
      alert('Emergency stop initiated. Server will shutdown in 5 seconds.');
      // The page will become unresponsive as the server shuts down
    } catch (error) {
      console.error('Error initiating emergency stop:', error);
      alert(`Emergency stop failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setEmergencyStopping(false);
    }
  };

  const fetchAdminLogs = async () => {
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from('admin_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching admin logs:', error);
        return;
      }

      setAdminLogs(data || []);
    } catch (error) {
      console.error('Error fetching admin logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getUserBalanceFromTransactions = async (userId: number): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('gc_transactions')
        .select('balance_after')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return 0;
      }

      return parseFloat(data.balance_after || '0');
    } catch (error) {
      console.error('Error fetching balance from transactions:', error);
      return 0;
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const { data: usersData, error } = await supabase
        .from('users')
        .select(`
          id,
          username,
          email,
          discord_id,
          banned,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        return;
      }

      // Fetch balances for each user using the proper helper function
      const formattedUsers = await Promise.all(
        usersData?.map(async (user) => {
          let balance = await gcBalanceHelpers.getUserBalance(user.id);
          
          // If balance is 0, try to get it from transactions
          if (balance === 0) {
            balance = await getUserBalanceFromTransactions(user.id);
          }
          
          return {
            ...user,
            gc_balance: balance,
            // Provide a better fallback for username
            displayName: user.username || user.email?.split('@')[0] || `User-${user.id}`
          };
        }) || []
      );

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchTotalGCCirculation = async () => {
    try {
      // Calculate total circulation from actual user balances
      const { data: balanceData, error: balanceError } = await supabase
        .from('gc_balances')
        .select('balance');

      if (balanceError) {
        console.error('Error fetching GC balances:', balanceError);
        return;
      }

      // Calculate total deposits and withdrawals for reference
      const { data: transactionData, error: transactionError } = await supabase
        .from('gc_transactions')
        .select('transaction_type, amount');

      if (transactionError) {
        console.error('Error fetching GC transactions:', transactionError);
        return;
      }

      // Calculate actual total circulation (what users have)
      const totalCirculation = balanceData?.reduce((sum, balance) => 
        sum + parseFloat(balance.balance || '0'), 0
      ) || 0;

      // Calculate total deposits and withdrawals for reference
      let totalDeposits = 0;
      let totalWithdrawals = 0;

      transactionData?.forEach(transaction => {
        const amount = parseFloat(transaction.amount || '0');
        
        if (transaction.transaction_type === 'deposit') {
          totalDeposits += amount;
        } else if (transaction.transaction_type === 'withdrawal') {
          totalWithdrawals += amount;
        }
      });

      setTotalGCCirculation(totalCirculation);
      
      // Store deposit/withdrawal totals for display
      setGcStats({
        totalCirculation,
        totalDeposits,
        totalWithdrawals
      });
    } catch (error) {
      console.error('Error fetching GC circulation:', error);
    }
  };

  const fetchUserStats = async (userId: number) => {
    try {
      setLoadingStats(true);
      
      // Get crash game stats
      const { data: crashBets, error: crashError } = await supabase
        .from('crash_bets')
        .select('bet_amount, payout_amount, status')
        .eq('user_id', userId);

      if (crashError) {
        console.error('Error fetching crash bets:', crashError);
        return;
      }

      // Calculate stats from crash bets
      let totalBets = 0;
      let totalWon = 0;
      let totalLost = 0;
      let biggestWin = 0;
      let biggestLoss = 0;
      let gamesPlayed = 0;

      crashBets?.forEach(bet => {
        const betAmount = parseFloat(bet.bet_amount || '0');
        const payoutAmount = parseFloat(bet.payout_amount || '0');
        
        totalBets += betAmount;
        
        if (bet.status === 'cashed_out' && payoutAmount > 0) {
          totalWon += payoutAmount;
          biggestWin = Math.max(biggestWin, payoutAmount);
        } else if (bet.status === 'crashed') {
          totalLost += betAmount;
          biggestLoss = Math.max(biggestLoss, betAmount);
        }
        
        gamesPlayed++;
      });

      const netProfit = totalWon - totalLost;

      setUserStats({
        total_bets: totalBets,
        total_won: totalWon,
        total_lost: totalLost,
        net_profit: netProfit,
        games_played: gamesPlayed,
        biggest_win: biggestWin,
        biggest_loss: biggestLoss
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const toggleUserBan = async (userId: number) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      const { error } = await supabase
        .from('users')
        .update({ banned: !user.banned })
        .eq('id', userId);

      if (error) {
        console.error('Error updating user ban status:', error);
        return;
      }

      // Update local state
      setUsers(users.map(u => 
        u.id === userId ? { ...u, banned: !u.banned } : u
      ));
    } catch (error) {
      console.error('Error toggling user ban:', error);
    }
  };

  const resetUserGC = async (userId: number) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      // Direct balance reset to 0
      const { error } = await supabase
        .from('gc_balances')
        .update({ balance: 0 })
        .eq('user_id', userId);

      if (error) {
        console.error('Error resetting user GC:', error);
        return;
      }

      // Create a transaction record for audit trail
      const { error: transactionError } = await supabase
        .from('gc_transactions')
        .insert({
          user_id: userId,
          transaction_type: 'refund',
          amount: 0,
          balance_before: user.gc_balance || 0,
          balance_after: 0,
          game_type: 'admin',
          game_id: 'admin_reset',
          description: 'GC balance reset by admin'
        });

      if (transactionError) {
        console.error('Error creating reset transaction:', transactionError);
      }

      // Update local state
      setUsers(users.map(u => 
        u.id === userId ? { ...u, gc_balance: 0 } : u
      ));

      // Refresh total GC circulation
      fetchTotalGCCirculation();
    } catch (error) {
      console.error('Error resetting user GC:', error);
    }
  };

  const adjustUserGC = async (userId: number, adjustment: number) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      let transactionType = 'bonus';
      if (adjustment < 0) {
        transactionType = 'withdrawal';
      }

      // Use the proper balance update method
      const newBalance = await gcBalanceHelpers.updateBalance(
        userId,
        adjustment,
        transactionType,
        'admin',
        'admin_adjustment',
        `GC balance adjusted by admin: ${adjustment > 0 ? '+' : ''}${adjustment}`
      );

      // Update local state
      setUsers(users.map(u => 
        u.id === userId ? { ...u, gc_balance: newBalance } : u
      ));

      // Refresh total GC circulation
      fetchTotalGCCirculation();
    } catch (error) {
      console.error('Error adjusting user GC:', error);
    }
  };

  const handleViewStats = async (user: User) => {
    setSelectedUser(user);
    setShowStatsModal(true);
    await fetchUserStats(user.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-xl">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
              <div className="text-center text-white max-w-md mx-auto px-4">
        <div className="text-6xl mb-6">🚫</div>
        <h2 className="text-3xl font-bold mb-4">Access denied</h2>
        <p className="text-lg mb-8 text-gray-300">You need admin privileges to access this page.</p>
        <Link to="/">
          <LightButton>← Back to Home</LightButton>
        </Link>
      </div>
      </div>
    );
  }

  const tabs = [
    { id: "users", name: "👥 User management", icon: "👥" },
    { id: "gc", name: "💰 GC tracker", icon: "💰" },
    { id: "stats", name: "📊 Gamemode stats", icon: "📊" },
    { id: "logs", name: "⚙️ Admin logs & tools", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-8 pt-24 sm:pt-28 md:pt-32">

        {/* Tab Navigation */}
        <div className="bg-gray-900 rounded-lg mb-8 border border-yellow-500/20">
          <div className="flex border-b border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center ${
                  activeTab === tab.id
                    ? 'text-yellow-400 border-b-2 border-yellow-400 bg-gray-800'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className="text-2xl">{tab.icon}</span>
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* User Management Tab */}
            {activeTab === "users" && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">User management</h2>
                
                {loadingUsers ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading users...</p>
                  </div>
                ) : (
                  <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-hide">
                  <table className="w-full bg-gray-800 rounded-lg min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left p-4 text-white whitespace-nowrap">Username</th>
                        <th className="text-left p-4 text-white whitespace-nowrap">Discord ID</th>
                        <th className="text-left p-4 text-white whitespace-nowrap">Email</th>
                        <th className="text-left p-4 text-white whitespace-nowrap">GC balance</th>
                        <th className="text-left p-4 text-white whitespace-nowrap">Status</th>
                        <th className="text-left p-4 text-white whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-700">
                              <td className="p-4 text-white whitespace-nowrap">{user.displayName}</td>
                              <td className="p-4 text-gray-300 whitespace-nowrap">{user.discord_id || 'N/A'}</td>
                          <td className="p-4 text-gray-300 whitespace-nowrap">{user.email}</td>
                              <td className="p-4 text-yellow-400 whitespace-nowrap">{user.gc_balance || 0} GC</td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              user.banned ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                            }`}>
                              {user.banned ? 'Banned' : 'Active'}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => toggleUserBan(user.id)}
                                className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer whitespace-nowrap ${
                                  user.banned 
                                    ? 'bg-green-600 hover:bg-green-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white' 
                                    : 'bg-red-600 hover:bg-red-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white'
                                }`}
                              >
                                {user.banned ? 'Unban' : 'Ban'}
                              </button>
                              <button
                                onClick={() => resetUserGC(user.id)}
                                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-xs font-semibold cursor-pointer whitespace-nowrap"
                              >
                                Reset GC
                              </button>
                                  <button
                                    onClick={() => handleViewStats(user)}
                                    className="bg-blue-600 hover:bg-blue-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white px-3 py-1 rounded text-xs font-semibold cursor-pointer whitespace-nowrap"
                                  >
                                  View stats
                                </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4 max-h-[600px] overflow-y-auto scrollbar-hide">
                  {users.map((user) => (
                    <div key={user.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                              <span className="text-white font-semibold">{user.displayName}</span>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.banned ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                          }`}>
                            {user.banned ? 'Banned' : 'Active'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Discord ID:</span>
                                <span className="text-gray-300">{user.discord_id || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Email:</span>
                            <span className="text-gray-300 truncate">{user.email}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">GC Balance:</span>
                                <span className="text-yellow-400">{user.gc_balance || 0} GC</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
                          <button
                            onClick={() => toggleUserBan(user.id)}
                            className={`px-3 py-2 rounded text-sm font-semibold cursor-pointer ${
                              user.banned 
                                ? 'bg-green-600 hover:bg-green-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white' 
                                : 'bg-red-600 hover:bg-red-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white'
                            }`}
                          >
                            {user.banned ? 'Unban' : 'Ban'}
                          </button>
                          <button
                            onClick={() => resetUserGC(user.id)}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm font-semibold cursor-pointer"
                          >
                            Reset GC
                          </button>
                              <button
                                onClick={() => handleViewStats(user)}
                                className="bg-blue-600 hover:bg-blue-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white px-3 py-2 rounded text-sm font-semibold cursor-pointer"
                              >
                              View stats
                            </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                  </>
                )}
              </div>
            )}

            {/* GC Tracker Tab */}
            {activeTab === "gc" && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">GC tracker</h2>
                
                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gray-800 rounded-lg p-6 text-center">
                    <div className="text-3xl font-bold text-yellow-400">{gcStats.totalCirculation.toLocaleString()}</div>
                    <div className="text-gray-400">Total GC in circulation</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-6 text-center">
                    <div className="text-3xl font-bold text-green-400">{gcStats.totalDeposits.toLocaleString()}</div>
                    <div className="text-gray-400">Total deposited</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-6 text-center">
                    <div className="text-3xl font-bold text-red-400">{gcStats.totalWithdrawals.toLocaleString()}</div>
                    <div className="text-gray-400">Total withdrawn</div>
                  </div>
                </div>

                {/* Individual User GC Editor */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Individual GC balance editor</h3>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-hide">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left p-3 text-white">User</th>
                          <th className="text-left p-3 text-white">Current balance</th>
                          <th className="text-left p-3 text-white">Adjustment</th>
                          <th className="text-left p-3 text-white">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b border-gray-700">
                            <td className="p-3 text-white">{user.displayName}</td>
                            <td className="p-3 text-yellow-400">{user.gc_balance || 0} GC</td>
                            <td className="p-3">
                              <input
                                type="number"
                                placeholder="±amount"
                                value={gcAdjustments[user.id] || ''}
                                onChange={(e) => setGcAdjustments(prev => ({ 
                                  ...prev, 
                                  [user.id]: parseFloat(e.target.value) || 0 
                                }))}
                                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white w-24"
                              />
                            </td>
                            <td className="p-3">
                              <button 
                                onClick={() => adjustUserGC(user.id, gcAdjustments[user.id] || 0)}
                                className="bg-blue-600 hover:bg-blue-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white px-3 py-1 rounded text-sm font-semibold mr-2 cursor-pointer"
                              >
                                Apply
                              </button>
                              <button 
                                onClick={() => setGcAdjustments(prev => ({ ...prev, [user.id]: 0 }))}
                                className="bg-red-600 hover:bg-red-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white px-3 py-1 rounded text-sm font-semibold cursor-pointer"
                              >
                                Reset
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Gamemode Stats Tab */}
            {activeTab === "stats" && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Gamemode statistics</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {gamemodeStats.map((stat, index) => (
                    <div key={index} className="bg-gray-800 rounded-lg p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <span className="text-2xl">{stat.icon}</span>
                        <h3 className="text-xl font-bold text-white">{stat.gamemode}</h3>
                        {stat.isActive ? (
                          <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">Active</span>
                        ) : (
                          <span className="bg-gray-600 text-white px-2 py-1 rounded text-xs">Inactive</span>
                        )}
                      </div>
                      
                      {stat.isActive ? (
                        // Active gamemode - show real stats
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Uptime:</span>
                          <span className={`font-bold ${stat.uptime >= 99.5 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {stat.uptime}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Players online:</span>
                          <span className="text-white font-bold">{stat.playersOnline}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">House profit:</span>
                          <span className="text-green-400 font-bold">+{stat.houseProfit} GC</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">House expense:</span>
                          <span className="text-red-400 font-bold">-{stat.houseExpense} GC</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-700 pt-2">
                          <span className="text-gray-400">Net profit:</span>
                          <span className="text-yellow-400 font-bold">
                            +{stat.houseProfit - stat.houseExpense} GC
                          </span>
                        </div>
                          
                          {/* Additional real stats for active gamemodes */}
                          {stat.totalBets && (
                            <>
                              <div className="border-t border-gray-700 pt-2 mt-3">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Total bets:</span>
                                  <span className="text-white font-bold">{stat.totalBets}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Wins:</span>
                                  <span className="text-green-400 font-bold">{stat.wins}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Losses:</span>
                                  <span className="text-red-400 font-bold">{stat.losses}</span>
                                </div>
                                {stat.avgMultiplier && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Avg multiplier:</span>
                                    <span className="text-yellow-400 font-bold">{stat.avgMultiplier}x</span>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        // Inactive gamemode - show placeholder
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Status:</span>
                            <span className="text-gray-500 font-bold">Not implemented</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Players online:</span>
                            <span className="text-gray-500 font-bold">-</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">House profit:</span>
                            <span className="text-gray-500 font-bold">-</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">House expense:</span>
                            <span className="text-gray-500 font-bold">-</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-2">
                            <span className="text-gray-400">Net profit:</span>
                            <span className="text-gray-500 font-bold">-</span>
                        </div>
                      </div>
                      )}

                      {/* Chart placeholder - only show for active gamemodes */}
                      {stat.isActive && (
                      <div className="mt-4 bg-gray-700 rounded p-3">
                        <div className="text-sm text-gray-400 mb-2">24h trend</div>
                        <div className="flex items-end h-16 w-full">
                          {[...Array(24)].map((_, i) => (
                            <div
                              key={i}
                              className="bg-yellow-400 flex-1 mx-px rounded-t"
                              style={{ height: `${Math.random() * 100}%` }}
                            ></div>
                          ))}
                        </div>
                      </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Logs & Tools Tab */}
            {activeTab === "logs" && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Admin logs & tools</h2>
                
                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <GoldButton 
                    onClick={() => setShowDisableModal(true)}
                    className="flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Disable access</span>
                  </GoldButton>
                  <button 
                    onClick={() => setShowEmergencyModal(true)}
                    disabled={emergencyStopping}
                    className={`bg-red-600 hover:bg-red-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white px-4 py-2 rounded font-semibold flex items-center justify-center space-x-2 cursor-pointer ${
                      emergencyStopping ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {emergencyStopping ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Stopping...</span>
                      </div>
                    ) : (
                      <span>Emergency stop</span>
                    )}
                  </button>
                  <button className="bg-blue-600 hover:bg-blue-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white px-4 py-2 rounded font-semibold flex items-center justify-center space-x-2 cursor-pointer">
                    <span>Generate report</span>
                  </button>
                </div>

                {/* Admin Logs */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Backend logs</h3>
                    <button 
                      onClick={fetchAdminLogs}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm cursor-pointer"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide">
                    {loadingLogs ? (
                      <div className="text-gray-400 text-center py-4">Loading logs...</div>
                    ) : adminLogs.length > 0 ? (
                      adminLogs.map((log) => {
                        const timestamp = new Date(log.timestamp).toLocaleString();
                        const timeAgo = getTimeAgo(new Date(log.timestamp));
                        
                        return (
                          <div key={log.id} className={`flex items-start space-x-4 p-3 rounded ${
                            log.level === 'error' ? 'bg-red-900/30 border border-red-500/30' :
                            log.level === 'warning' ? 'bg-yellow-900/30 border border-yellow-500/30' :
                            log.level === 'success' ? 'bg-green-900/30 border border-green-500/30' :
                            'bg-gray-700'
                          }`}>
                            <div className="text-gray-400 text-sm w-32 flex-shrink-0">{timeAgo}</div>
                        <div className="flex-1">
                              <div className="text-white font-semibold">{log.message}</div>
                              {log.details && (
                                <div className="text-gray-300 text-sm mt-1">
                                  {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                                </div>
                              )}
                            </div>
                            <div className={`text-sm flex-shrink-0 ${
                              log.level === 'error' ? 'text-red-400' :
                              log.level === 'warning' ? 'text-yellow-400' :
                              log.level === 'success' ? 'text-green-400' :
                              'text-blue-400'
                            }`}>
                              {log.level.toUpperCase()}
                        </div>
                      </div>
                        );
                      })
                    ) : (
                      <div className="text-gray-400 text-center py-4">No logs available</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Disable Access Modal */}
        {showDisableModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Disable gamemode access</h3>
                <button
                  onClick={() => setShowDisableModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              {loadingRestrictions ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading gamemode restrictions...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-300 mb-4">
                    Select which gamemodes to disable for users with the "user" role. Disabled gamemodes will not be accessible to regular users.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {gamemodeRestrictions.map((restriction) => (
                      <div key={restriction.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-lg font-semibold text-white capitalize">
                            {restriction.gamemode}
                          </h4>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              restriction.is_disabled 
                                ? 'bg-red-600 text-white' 
                                : 'bg-green-600 text-white'
                            }`}>
                              {restriction.is_disabled ? 'Disabled' : 'Enabled'}
                            </span>
                          </div>
                        </div>
                        
                        {restriction.is_disabled && restriction.disabled_at && (
                          <div className="text-sm text-gray-400 mb-3">
                            Disabled: {new Date(restriction.disabled_at).toLocaleString()}
                            {restriction.reason && (
                              <div className="mt-1">
                                Reason: {restriction.reason}
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => toggleGamemodeAccess(restriction.gamemode, !restriction.is_disabled)}
                            disabled={updatingGamemode === restriction.gamemode}
                            className={`px-3 py-2 rounded text-sm font-semibold cursor-pointer ${
                              restriction.is_disabled
                                ? 'bg-green-600 hover:bg-green-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white'
                                : 'bg-red-600 hover:bg-red-700 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] text-white'
                            } ${updatingGamemode === restriction.gamemode ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {updatingGamemode === restriction.gamemode ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Updating...</span>
                              </div>
                            ) : (
                              restriction.is_disabled ? 'Enable' : 'Disable'
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setShowDisableModal(false)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Stats Modal */}
        {showStatsModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">
                  Stats for {selectedUser.displayName || selectedUser.username || 'Unknown User'}
                </h3>
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              {loadingStats ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading stats...</p>
                </div>
              ) : userStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-yellow-400">{userStats.games_played}</div>
                      <div className="text-gray-400 text-sm">Games played</div>
                    </div>
                    <div className="bg-gray-800 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-blue-400">{userStats.total_bets.toLocaleString()}</div>
                      <div className="text-gray-400 text-sm">Total bet</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-green-400">{userStats.total_won.toLocaleString()}</div>
                      <div className="text-gray-400 text-sm">Total won</div>
                    </div>
                    <div className="bg-gray-800 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-red-400">{userStats.total_lost.toLocaleString()}</div>
                      <div className="text-gray-400 text-sm">Total lost</div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded p-3 text-center">
                    <div className={`text-2xl font-bold ${userStats.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {userStats.net_profit >= 0 ? '+' : ''}{userStats.net_profit.toLocaleString()}
                    </div>
                    <div className="text-gray-400 text-sm">Net profit/loss</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800 rounded p-3 text-center">
                      <div className="text-lg font-bold text-green-400">{userStats.biggest_win.toLocaleString()}</div>
                      <div className="text-gray-400 text-sm">Biggest win</div>
                    </div>
                    <div className="bg-gray-800 rounded p-3 text-center">
                      <div className="text-lg font-bold text-red-400">{userStats.biggest_loss.toLocaleString()}</div>
                      <div className="text-gray-400 text-sm">Biggest loss</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">No stats available for this user</p>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Emergency Stop Modal */}
        {showEmergencyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-red-500/30">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                  <span className="text-red-400">⚠️</span>
                  <span>Emergency stop</span>
                </h3>
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-6">
                <div className="bg-red-900/30 border border-red-500/30 rounded p-4 mb-4">
                  <p className="text-red-300 text-sm font-semibold mb-2">⚠️ Warning</p>
                  <p className="text-gray-300 text-sm">
                    This action will immediately shutdown the backend server. All active games will be terminated and users will be disconnected.
                  </p>
                </div>
                
                <p className="text-gray-300 text-sm">
                  Are you sure you want to initiate an emergency stop? This action cannot be undone.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEmergencyStop}
                  disabled={emergencyStopping}
                  className={`bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold cursor-pointer flex items-center space-x-2 ${
                    emergencyStopping ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {emergencyStopping ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Stopping...</span>
                    </>
                  ) : (
                    <span>Emergency stop</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
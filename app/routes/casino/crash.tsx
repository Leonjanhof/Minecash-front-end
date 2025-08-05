import type { Route } from "./+types/crash";
import { useAuth } from "../../contexts/AuthContext";
import { useGCBalance } from "../../contexts/GCBalanceContext";
import { LightButton, GoldButton } from "../../components/Button";
import { ChatSidebar } from "../../components/ChatSidebar";
import { NotificationManager } from "../../components/Notification";
import { GamemodeAccessCheck } from "../../components/GamemodeAccessCheck";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { websocketService } from "../../lib/websocket";
import CrashRocketScene from "../../components/CrashRocketScene";
import { supabase, crashRoundsHelpers } from "../../lib/supabase";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Crash - MINECASH" },
    { name: "description", content: "Cash out before the crash! Test your timing in our exciting Crash game!" },
  ];
}

// GameLiveView component with real-time integration
function GameLiveView({ gameState, crashState, isConnected, lastRounds }: { 
  gameState: string; 
  crashState: any; 
  isConnected: boolean; 
  lastRounds: Array<{multiplier: number, roundNumber: number}>;
}) {
  const multiplier = crashState?.currentMultiplier ? parseFloat(crashState.currentMultiplier) : 1.0;
  const phase = crashState?.phase || 'waiting';
  const roundNumber = crashState?.currentRoundNumber || 1;
  
  // Determine how many rounds to show based on screen size
  const getVisibleRounds = () => {
    if (typeof window === 'undefined') return 20; // SSR fallback
    
    const width = window.innerWidth;
    if (width < 640) return 8;      // Mobile: 8 rounds
    if (width < 768) return 12;     // Small tablet: 12 rounds
    if (width < 1024) return 16;    // Large tablet: 16 rounds
    return 20;                      // Desktop: 20 rounds
  };
  
  // State to track visible rounds count
  const [visibleRounds, setVisibleRounds] = useState(getVisibleRounds());
  
  // Update visible rounds when window resizes
  useEffect(() => {
    const handleResize = () => {
      setVisibleRounds(getVisibleRounds());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const getPhaseColor = () => {
    switch (phase) {
      case 'betting': return 'bg-blue-600';
      case 'playing': return 'bg-green-600';
      case 'crashed': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getPhaseText = () => {
    switch (phase) {
      case 'betting': return 'Betting Open';
      case 'playing': return 'Game Running';
      case 'crashed': return 'Crashed!';
      default: return 'Waiting...';
    }
  };

  return (
    <div className="w-full h-[500px] bg-[#F5F5F5] rounded-lg border-2 border-yellow-400 relative overflow-hidden">
      {/* 3D Rocket Scene - Background */}
      <div className="absolute inset-0 z-0">
        <CrashRocketScene 
          multiplier={parseFloat(multiplier)} 
          phase={phase} 
          className="w-full h-full"
        />
      </div>
      
      {/* UI Overlay - Fully responsive */}
      <div className={`absolute z-10 pointer-events-none transition-all duration-500 ${
        phase === 'playing' 
          ? 'top-2 right-2 sm:top-4 sm:right-4 md:top-6 md:right-6 flex flex-col items-end' 
          : 'inset-0 flex items-center justify-center'
      }`}>
        <div className={`text-black ${phase === 'playing' ? 'text-right' : 'text-center'}`}>
          {/* Multiplier Display - Responsive sizing */}
          <div className="mb-2 sm:mb-4 lg:mb-6">
            <div className={`font-bold text-yellow-400 mb-1 sm:mb-2 drop-shadow-lg ${
              phase === 'playing' 
                ? 'text-lg sm:text-2xl md:text-3xl lg:text-4xl' 
                : 'text-4xl sm:text-6xl md:text-8xl lg:text-9xl'
            }`}>
              {multiplier.toFixed(2)}x
            </div>
          </div>

          {/* Round Hash Information - Hide during playing, responsive */}
          {phase !== 'playing' && (
            <div className="mb-2 sm:mb-4 lg:mb-6">
              <div className="text-xs opacity-70 break-all max-w-[150px] sm:max-w-[200px] md:max-w-xs mx-auto mb-1 sm:mb-2">
                {crashState?.gameHash || 'Loading...'}
              </div>
              <div className="text-xs sm:text-sm font-mono text-gray-600 mb-1">Round</div>
              <div className="text-sm sm:text-lg md:text-xl font-bold text-black">
                {crashState?.currentRoundNumber || 1}
              </div>
            </div>
          )}

          {/* Game Status - Responsive sizing */}
          <div className={`flex space-x-2 sm:space-x-3 md:space-x-4 ${phase === 'playing' ? 'justify-end' : 'justify-center'}`}>
            {phase === 'playing' && (
              <div className="bg-green-600 rounded-lg w-10 h-5 sm:w-12 sm:h-6 md:w-16 md:h-8 flex items-center justify-center text-white font-bold text-xs sm:text-sm md:text-base animate-pulse">
                LIVE
              </div>
            )}
            
            {phase === 'crashed' && (
              <div className="bg-red-600 rounded-lg w-12 h-8 sm:w-16 sm:h-10 md:w-24 md:h-16 flex items-center justify-center text-white font-bold text-sm sm:text-lg md:text-xl animate-bounce">
                CRASH
              </div>
            )}
            
            {phase === 'betting' && (
              <div className="bg-blue-600 rounded-lg w-12 h-8 sm:w-16 sm:h-10 md:w-20 md:h-16 flex items-center justify-center text-white font-bold text-sm sm:text-lg md:text-xl">
                BET
              </div>
            )}
          </div>

          {/* Connection Warning - Responsive */}
          {!isConnected && (
            <div className="mt-2 sm:mt-3 md:mt-4 p-2 sm:p-3 bg-red-600 rounded-lg">
              <div className="text-xs sm:text-sm md:text-base font-semibold text-white">Connection lost</div>
              <div className="text-xs opacity-80 text-white">Reconnecting...</div>
            </div>
          )}
        </div>
      </div>

      {/* Last 20 Rounds - Horizontal row at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/20 backdrop-blur-sm">
        <div className="flex justify-center items-center h-12 px-2">
          <div 
            className="flex space-x-1 overflow-x-auto max-w-full scrollbar-hide sm:scrollbar-auto"
            ref={(el) => {
              if (el && lastRounds.length > 0) {
                // Auto-scroll to the end to show latest rounds
                el.scrollLeft = el.scrollWidth;
              }
            }}
          >
            {/* Show the last 20 rounds - oldest to newest, left to right */}
            {lastRounds.slice(-20).map((round, index) => (
              <div
                key={round.roundNumber}
                className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-xs ${
                  round.multiplier >= 2 ? 'bg-green-600' : 'bg-red-600'
                }`}
                title={`Round ${round.roundNumber}: ${round.multiplier.toFixed(2)}x`}
              >
                {round.multiplier.toFixed(2)}
              </div>
            ))}
            {lastRounds.length === 0 && (
              <div className="text-white text-xs opacity-70">Loading recent rounds...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Crash() {
  const { user, loading, session } = useAuth();
  const { balance, updateBalance } = useGCBalance();
  const [bet, setBet] = useState(10);
  const [betInput, setBetInput] = useState("10");
  const [autoCashout, setAutoCashout] = useState(1.5);
  const [autoCashoutActive, setAutoCashoutActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState('waiting');
  const [currentBetAmount, setCurrentBetAmount] = useState(0); // Track actual bet for current round
  const [lastRounds, setLastRounds] = useState<Array<{multiplier: number, roundNumber: number}>>([]);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    message: string;
    type: 'error' | 'success' | 'warning';
  }>>([]);
  const [crashState, setCrashState] = useState({
    phase: 'waiting',
    currentMultiplier: 1.0,
    currentRoundNumber: 1,
    activePlayersCount: 0,
    totalBetAmount: 0.00
  });

  // Debug logging for current bet amount changes
  useEffect(() => {
    console.log('current bet amount changed to:', currentBetAmount);
  }, [currentBetAmount]);

  // Add notification helper
  const addNotification = (message: string, type: 'error' | 'success' | 'warning') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove notification after 2 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 2000);
  };

  // Remove notification helper
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Connect to WebSocket when component mounts
  useEffect(() => {
    // Only proceed if user is fully loaded (not null and not loading)
    if (user && session?.access_token && !loading) {
      console.log('crash component setting up webSocket connection');
      
      // Check if already connected before setting up callbacks
      const wasAlreadyConnected = websocketService.isConnected();
      
      websocketService.connect({
        onConnect: () => {
          console.log('webSocket connected to crash game');
          setIsConnected(true);
          
          // Always join the crash room when connecting (let backend handle duplicates)
          console.log('joining crash room');
          websocketService.joinGame('crash', session.access_token);
          
          // Request current game state to sync up (always request state on connect)
          setTimeout(() => {
            websocketService.send({
              type: 'request_game_state',
              gamemode: 'crash'
            });
          }, 500); // Small delay to ensure join is processed first
        },
        onDisconnect: () => {
          console.log('webSocket disconnected from crash game');
          setIsConnected(false);
          // Don't reset isInRoom here - let the reconnection handle it
        },
        onMessage: (message) => {
          // Completely ignore any ping/pong messages to prevent error notifications
          if (message.type && (message.type.toLowerCase().includes('ping') || message.type.toLowerCase().includes('pong'))) {
            console.log('Blocked ping/pong message:', message.type);
            return;
          }
          
          // Additional safety check - ignore any message that might be related to pong
          if (message && typeof message === 'object' && message.type && message.type.toLowerCase().includes('pong')) {
            console.log('Blocked pong-related message:', message.type);
            return;
          }
          
          // Handle non-chat game messages only
          switch (message.type) {
            case 'joined_game':
              console.log('joined crash game');
              break;
            case 'bet_confirmed':
            case 'crash_bet_confirmed':
              console.log('bet confirmed:', message);
              // Set current bet amount immediately from the bet confirmation
              if (message.betAmount) {
                console.log('setting current bet amount from bet confirmation:', message.betAmount);
                setCurrentBetAmount(message.betAmount);
              }
              addNotification('Bet placed successfully!', 'success');
              console.log('bet confirmed - waiting for state update to set current bet amount');
              break;
            case 'bet_failed':
              console.log('bet failed:', message);
              addNotification(message.message || 'Bet failed', 'error');
              break;
            case 'bet_placed':
              console.log('bet placed by player:', message.userData?.username);
              break;
            case 'game_result':
              console.log('game result:', message);
              break;
            case 'game_action_success':
            case 'crash_cashout_confirmed':
              console.log('game action success:', message);
              if (message.action === 'cashout' || message.type === 'crash_cashout_confirmed') {
                const multiplier = message.result?.cashoutMultiplier || message.cashoutMultiplier || message.result?.multiplier;
                const payout = message.result?.cashoutAmount || message.cashoutAmount || message.result?.payout || message.payoutAmount;
                addNotification(`Cashed out at ${multiplier}x for ${payout} GC!`, 'success');
                // Reset bet amount after successful cashout
                setCurrentBetAmount(0);
                // Update balance if provided
                if (message.result?.newBalance !== undefined || message.newBalance !== undefined) {
                  const newBalance = message.result?.newBalance || message.newBalance;
                  updateBalance(newBalance - balance, 'game_win', 'crash', message.result?.gameId || 'crash_round', `Cashout at ${multiplier}x`);
                }
              } else if (message.action === 'auto_cashout') {
                addNotification(`Auto cashout enabled at ${message.result.target_multiplier}x!`, 'success');
                setAutoCashoutActive(true);
              }
              break;
            case 'game_action_failed':
              console.log('game action failed:', message);
              addNotification(message.message || 'Game action failed', 'warning');
              break;
            case 'error':
              // Filter out pong-related error messages to prevent error notifications
              const errorMsg = message.message || '';
              if (errorMsg.toLowerCase().includes('pong') || errorMsg.toLowerCase().includes('ping')) {
                console.log('Blocked pong-related error message:', errorMsg);
                return;
              }
              
              console.log('websocket error:', message);
              addNotification(message.message || 'An error occurred', 'error');
              break;
            case 'crash_state_update':
              console.log('crash state update:', message.state);
              // Only update if we're not in crashed phase or if we have a valid crash point
              if (message.state.phase !== 'crashed' || message.state.currentMultiplier > 1.0) {
                setCrashState(message.state);
              }
              
              // Handle bet state updates more robustly
              if (message.state.current_user_bet && message.state.current_user_bet.amount) {
                console.log('setting current bet amount to:', message.state.current_user_bet.amount);
                setCurrentBetAmount(message.state.current_user_bet.amount);
              } else if (message.state.phase === 'crashed' || message.state.phase === 'waiting') {
                // Reset bet when game ends or new round starts
                console.log('resetting bet amount - game ended or new round');
                setCurrentBetAmount(0);
              }
              
              // Only update last rounds if we're in waiting phase (not during betting, playing, or crashed)
              if (message.state.phase === 'waiting') {
                if (message.state.last_rounds) {
                  setLastRounds(message.state.last_rounds);
                } else {
                  // If no last_rounds provided, fetch fresh data to ensure we have the latest
                  setTimeout(async () => {
                    try {
                      const freshRounds = await crashRoundsHelpers.getLastRounds(20);
                      setLastRounds(freshRounds);
                    } catch (error) {
                      console.error('Error refreshing last rounds:', error);
                    }
                  }, 100);
                }
              }
              
              // Log multiplier for debugging
              console.log('crash multiplier:', message.state.currentMultiplier);
              
              // Additional logging for debugging
              console.log('current bet amount after update:', message.state.current_user_bet?.amount || 0);
              break;
            case 'game_state_update':
              console.log('game state update:', message.state);
              if (message.gamemode === 'crash') {
                setCrashState(message.state);
                
                // Handle bet state updates more robustly
                if (message.state.current_user_bet && message.state.current_user_bet.amount) {
                  console.log('setting current bet amount to:', message.state.current_user_bet.amount);
                  setCurrentBetAmount(message.state.current_user_bet.amount);
                } else if (message.state.phase === 'crashed' || message.state.phase === 'waiting') {
                  // Reset bet when game ends or new round starts
                  console.log('resetting bet amount - game ended or new round');
                  setCurrentBetAmount(0);
                }
                
                // Update last rounds if provided
                if (message.state.last_rounds) {
                  setLastRounds(message.state.last_rounds); // Data is already limited to 20
                }
                
                // Additional logging for debugging
                console.log('current bet amount after update:', message.state.current_user_bet?.amount || 0);
              }
              break;
            case 'round_completed':
              console.log('round completed:', message);
              addNotification(`Round ${message.roundNumber} completed at ${message.crashPoint}x!`, 'success');
              // Immediately refresh last rounds to show the completed round
              setTimeout(async () => {
                try {
                  // Fetch fresh data from database and replace the entire array
                  const freshRounds = await crashRoundsHelpers.getLastRounds(20);
                  setLastRounds(freshRounds);
                } catch (error) {
                  console.error('Error refreshing last rounds:', error);
                }
              }, 1000);
              break;
            case 'crash_final_value':
              console.log('crash final value received:', message);
              // Immediately update crash state with final value to sync displays
              // Use the exact crash point value from backend without additional formatting
              const crashPoint = parseFloat(message.crashPoint);
              setCrashState(prevState => ({
                ...prevState,
                currentMultiplier: crashPoint,
                phase: 'crashed'
              }));
              break;
            default:
              // Silently ignore unknown message types to prevent error notifications
              // Only log for debugging if it's not a ping/pong message
              if (message.type && !message.type.toLowerCase().includes('pong') && !message.type.toLowerCase().includes('ping')) {
                console.log('Unknown message type (ignored):', message.type);
              }
              break;

          }
        },
        onError: (error) => {
          // Filter out pong-related errors to prevent error notifications
          const errorMessage = error?.toString() || '';
          if (errorMessage.toLowerCase().includes('pong') || errorMessage.toLowerCase().includes('ping')) {
            console.log('Blocked pong-related error:', errorMessage);
            return;
          }
          
          console.error('webSocket error in crash game:', error);
          setIsConnected(false);
        }
      });

      // If WebSocket was already connected, join the room immediately
      if (wasAlreadyConnected) {
        console.log('webSocket was already connected - joining crash room directly');
        setIsConnected(true);
        websocketService.joinGame('crash', session.access_token);
      }

      // Cleanup on unmount
      return () => {
        console.log('crash component unmounting - leaving room');
        websocketService.leaveGame();
      };
    } else {
      console.log('crash component waiting for auth - user:', !!user, 'session:', !!session?.access_token, 'loading:', loading);
    }
  }, [user, session?.access_token, loading]);

  // Fetch last rounds when component mounts and keep them updated
  useEffect(() => {
    const fetchLastRounds = async () => {
      try {
        const rounds = await crashRoundsHelpers.getLastRounds(20);
        setLastRounds(rounds);
      } catch (error) {
        console.error('Error fetching last rounds:', error);
      }
    };

    fetchLastRounds();
    
    // Set up 16ms game loop sync for 60 FPS
    const gameLoopInterval = setInterval(() => {
      if (isConnected) {
        websocketService.send({
          type: 'request_game_state',
          gamemode: 'crash'
        });
      }
    }, 16); // 16ms (60 FPS) to match game loop speed
    
    return () => {
      clearInterval(gameLoopInterval);
    };
  }, [isConnected]);

  const handleBetInputChange = (value: string) => {
    setBetInput(value);
    const numValue = parseInt(value) || 0;
    if (numValue > 0) {
      setBet(numValue);
    }
  };

  const updateBet = (newBet: number) => {
    setBet(newBet);
    setBetInput(newBet.toString());
  };

  const handlePlaceBet = async () => {
    if (!user || !isConnected) {
      console.log('User not authenticated or WebSocket not connected');
      addNotification('Not connected to game server', 'error');
      return;
    }

    // Check if we're properly joined to the crash room
    if (websocketService.getCurrentGamemode() !== 'crash') {
      console.log('Not in crash room, attempting to join');
      websocketService.joinGame('crash', session?.access_token);
      addNotification('Reconnecting to game room...', 'warning');
      
      // Retry after a short delay
      setTimeout(() => {
        if (websocketService.getCurrentGamemode() === 'crash') {
          console.log('Successfully joined crash room, retrying bet');
          websocketService.placeBet(bet);
        }
      }, 1000);
      return;
    }

    // Check if user is banned
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('banned')
        .eq('auth_user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error checking ban status:', error);
        addNotification('Failed to verify user status', 'error');
        return;
      }
      
      if (userData?.banned) {
        addNotification('You are banned from placing bets', 'error');
        return;
      }
    } catch (error) {
      console.error('Error checking ban status:', error);
      addNotification('Failed to verify user status', 'error');
      return;
    }

    // Check if we're in betting phase - double check with a small delay to ensure state sync
    if (crashState.phase !== 'betting') {
      addNotification(`Betting is not open. Current phase: ${crashState.phase}`, 'error');
      return;
    }
    
    // Additional safety check - request current game state to ensure we have the latest phase
    if (isConnected) {
      websocketService.send({
        type: 'request_game_state',
        gamemode: 'crash'
      });
    }

    try {
      // Place bet via WebSocket
      console.log(`attempting to place bet: ${bet} GC`);
      websocketService.placeBet(bet);
      
      console.log(`bet request sent: ${bet} GC`);
    } catch (error) {
      console.error('Error placing bet:', error);
      addNotification('Failed to place bet', 'error');
    }
  };

  const handleGameAction = (action: string) => {
    if (!isConnected) return;
    
    // Check if we're properly joined to the crash room
    if (websocketService.getCurrentGamemode() !== 'crash') {
      console.log('Not in crash room, attempting to join');
      websocketService.joinGame('crash', session?.access_token);
      addNotification('Reconnecting to game room...', 'warning');
      
      // Retry after a short delay
      setTimeout(() => {
        if (websocketService.getCurrentGamemode() === 'crash') {
          console.log('Successfully joined crash room, retrying action');
          websocketService.sendGameAction(action);
        }
      }, 1000);
      return;
    }
    
    if (action === 'auto_cashout') {
      // Toggle auto-cashout state
      const newAutoCashoutActive = !autoCashoutActive;
      setAutoCashoutActive(newAutoCashoutActive);
      
      if (newAutoCashoutActive) {
        // Send auto-cashout action with target multiplier
        websocketService.sendGameAction('auto_cashout', { targetMultiplier: autoCashout });
        console.log(`Auto cashout enabled at ${autoCashout}x`);
      } else {
        // Disable auto-cashout (could be handled by sending a disable action)
        console.log('Auto cashout disabled');
      }
    } else {
      // Send other game actions
      websocketService.sendGameAction(action);
      console.log(`Game action: ${action}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-xl">Loading crash...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">📈</div>
          <h2 className="text-3xl font-bold mb-4">Sign in to play crash</h2>
          <p className="text-lg mb-8">Join our Discord community to start playing</p>
          <Link to="/">
            <LightButton>Go home</LightButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <GamemodeAccessCheck gamemode="crash">
      <div className="min-h-screen bg-black">
        {/* Notification Manager */}
        <NotificationManager notifications={notifications} onRemove={removeNotification} />
        
        <div className="container mx-auto px-4 py-8 pt-16 sm:pt-20 md:pt-24">
        <div className="mb-8 mt-8 sm:mt-3 md:mt-4">
          <GameLiveView 
            gameState={gameState} 
            crashState={crashState} 
            isConnected={isConnected} 
            lastRounds={lastRounds}
          />
        </div>

        <div className="bg-gray-900 rounded-lg p-4 sm:p-6 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 xl:items-stretch">
            {/* Betting Controls */}
            <div className="h-full flex flex-col">
              <h3 className="text-white font-bold text-lg mb-4">Place your bet</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-white text-sm block mb-1">Bet amount:</label>
                  <div className="flex items-center space-x-1 sm:space-x-2 w-full">
                    <button 
                      onClick={() => updateBet(Math.max(1, bet - 1))}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-2 sm:px-3 py-2 rounded transition-colors cursor-pointer flex-shrink-0 text-sm"
                    >
                      -1
                    </button>
                    <input
                      type="number"
                      value={betInput}
                      onChange={(e) => handleBetInputChange(e.target.value)}
                      className="bg-gray-800 border border-gray-600 px-2 sm:px-4 py-2 rounded text-center flex-1 text-yellow-400 font-bold focus:outline-none focus:border-yellow-400 text-sm sm:text-base"
                      min="1"
                      placeholder="0"
                    />
                    <span className="text-gray-400 flex-shrink-0 text-sm sm:text-base">GC</span>
                    <button 
                      onClick={() => updateBet(bet + 1)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-2 sm:px-3 py-2 rounded transition-colors cursor-pointer flex-shrink-0 text-sm"
                    >
                      +1
                    </button>
                  </div>
                  
                  {/* Quick Bet Buttons */}
                  <div className="grid grid-cols-5 gap-1 mt-2">
                    <button onClick={() => updateBet(bet + 5)} className="bg-gray-700 hover:bg-gray-600 text-white px-1 sm:px-2 py-1 rounded text-xs cursor-pointer">+5</button>
                    <button onClick={() => updateBet(bet + 10)} className="bg-gray-700 hover:bg-gray-600 text-white px-1 sm:px-2 py-1 rounded text-xs cursor-pointer">+10</button>
                    <button onClick={() => updateBet(bet + 25)} className="bg-gray-700 hover:bg-gray-600 text-white px-1 sm:px-2 py-1 rounded text-xs cursor-pointer">+25</button>
                    <button onClick={() => updateBet(bet + 50)} className="bg-gray-700 hover:bg-gray-600 text-white px-1 sm:px-2 py-1 rounded text-xs cursor-pointer">+50</button>
                    <button onClick={() => updateBet(bet + 100)} className="bg-gray-700 hover:bg-gray-600 text-white px-1 sm:px-2 py-1 rounded text-xs cursor-pointer">+100</button>
                  </div>
                </div>

                {/* Auto Cashout Settings */}
                <div>
                  <label className="text-white text-sm block mb-1">Auto cashout at:</label>
                  <div className="flex items-center space-x-1 sm:space-x-2 w-full">
                    <button 
                      onClick={() => setAutoCashout(Math.max(1.1, autoCashout - 0.1))}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-2 sm:px-3 py-2 rounded transition-colors cursor-pointer flex-shrink-0 text-sm"
                    >
                      -0.1
                    </button>
                    <input
                      type="number"
                      value={autoCashout}
                      onChange={(e) => setAutoCashout(parseFloat(e.target.value) || 1.5)}
                      className="bg-gray-800 border border-gray-600 px-2 sm:px-4 py-2 rounded text-center flex-1 text-yellow-400 font-bold focus:outline-none focus:border-yellow-400 text-sm sm:text-base"
                      min="1.1"
                      step="0.1"
                      placeholder="1.5"
                    />
                    <span className="text-gray-400 flex-shrink-0 text-sm sm:text-base">x</span>
                    <button 
                      onClick={() => setAutoCashout(autoCashout + 0.1)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-2 sm:px-3 py-2 rounded transition-colors cursor-pointer flex-shrink-0 text-sm"
                    >
                      +0.1
                    </button>
                  </div>

                </div>
              </div>
            </div>

            {/* Game Actions */}
            <div className="h-full flex flex-col">
              <div className="mb-8">
                <h3 className="text-white font-bold text-lg">Actions</h3>
              </div>
                             <div className="space-y-2">
                 {/* Cashout Mode Notification */}
                 {autoCashoutActive && (
                   <div className="bg-green-600 text-white px-3 py-2 rounded text-sm font-semibold text-center">
                     Auto cashout enabled at {autoCashout}x
                   </div>
                 )}
                 
                 {/* Betting Status Notification */}
                 {crashState.phase !== 'betting' && (
                   <div className="bg-red-600 text-white px-3 py-2 rounded text-sm font-semibold text-center">
                     Betting is {crashState.phase === 'playing' ? 'closed - game in progress' : 'closed'}
                   </div>
                 )}
                 
                 <GoldButton 
                   className="w-full" 
                   onClick={handlePlaceBet}
                   disabled={!isConnected || crashState.phase !== 'betting'}
                 >
                   {crashState.phase === 'betting' ? 'Bet' : 'Betting closed morron'}
                 </GoldButton>
                <button 
                  className={`w-full px-4 py-2 rounded font-semibold transition-colors cursor-pointer relative ${
                    autoCashoutActive 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  } ${autoCashoutActive ? 'opacity-50' : ''}`}
                  onClick={() => handleGameAction('cashout')}
                  disabled={!isConnected || autoCashoutActive}
                >
                  Cash out
                  {autoCashoutActive && (
                    <div className="absolute inset-0 bg-black opacity-20" style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.3) 4px, rgba(0,0,0,0.3) 8px)'
                    }}></div>
                  )}
                </button>
                <button 
                  className={`w-full px-4 py-2 rounded font-semibold transition-colors cursor-pointer ${
                    autoCashoutActive 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                  onClick={() => handleGameAction('auto_cashout')}
                  disabled={!isConnected}
                >
                  Auto cashout
                </button>
              </div>
            </div>

            {/* Game Status */}
            <div className="h-full flex flex-col">
              <div className="mb-8">
                <h3 className="text-white font-bold text-lg">Game status</h3>
              </div>
              <div className="bg-gray-800 rounded p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Your balance:</span>
                  <span className="text-yellow-400 font-bold">{balance} GC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Current bet:</span>
                  <span className="text-white font-bold">{currentBetAmount} GC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-yellow-400 font-bold">{crashState.phase}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Multiplier:</span>
                  <span className="text-white font-bold">{parseFloat(String(crashState.currentMultiplier)).toFixed(2)}x</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Chat */}
        <ChatSidebar gamemode="crash" />
        </div>
      </div>
    </GamemodeAccessCheck>
  );
}
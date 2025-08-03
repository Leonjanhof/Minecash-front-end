import type { Route } from "./+types/hi-lo";
import { useAuth } from "../../contexts/AuthContext";
import { useGCBalance } from "../../contexts/GCBalanceContext";
import { LightButton, GoldButton } from "../../components/Button";
import { ChatSidebar } from "../../components/ChatSidebar";
import { GamemodeAccessCheck } from "../../components/GamemodeAccessCheck";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { websocketService } from "../../lib/websocket";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hi-Lo - MINECASH" },
    { name: "description", content: "Guess if the next card is higher or lower. Build your streak for bigger wins!" },
  ];
}

function GameLiveView() {
  return (
    <div className="w-full h-[500px] bg-[#F5F5F5] rounded-lg border-2 border-yellow-400 flex items-center justify-center">
      <div className="text-center text-black">
        <div className="text-6xl mb-4">🎲</div>
        <h3 className="text-2xl font-bold mb-4">Hi-Lo cards</h3>
        
        {/* Current Card Display */}
        <div className="flex justify-center space-x-4 mb-4">
          <div className="bg-white rounded-lg w-24 h-36 flex flex-col items-center justify-center border-2 border-yellow-400 shadow-lg">
            <div className="text-4xl text-red-600 font-bold">K</div>
            <div className="text-2xl text-red-600">♥️</div>
          </div>
          <div className="flex items-center">
            <div className="text-3xl">🆚</div>
          </div>
          <div className="bg-gray-700 rounded-lg w-24 h-36 flex items-center justify-center border-2 border-gray-500">
            <div className="text-4xl">?</div>
          </div>
        </div>
        
        <p className="text-lg opacity-80">Will the next card be higher or lower?</p>
      </div>
    </div>
  );
}

export default function HiLo() {
  const { user, loading, session } = useAuth();
  const { balance, updateBalance } = useGCBalance();
  const [bet, setBet] = useState(10);
  const [betInput, setBetInput] = useState("10");
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [gameStatsExpanded, setGameStatsExpanded] = useState(false);
  const [multipliersExpanded, setMultipliersExpanded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState('waiting');

  // Connect to WebSocket when component mounts
  useEffect(() => {
    // Only proceed if user is fully loaded (not null and not loading)
    if (user && session?.access_token && !loading) {
      console.log('hiLo component setting up webSocket connection');
      
      // Check if already connected before setting up callbacks
      const wasAlreadyConnected = websocketService.isConnected();
      
      websocketService.connect({
        onConnect: () => {
          console.log('webSocket connected to hiLo game');
          setIsConnected(true);
          // Join the hi-lo room with authentication token
          websocketService.joinGame('hi-lo', session.access_token);
        },
        onDisconnect: () => {
          console.log('webSocket disconnected from hiLo game');
          setIsConnected(false);
        },
        onMessage: (message) => {
          // Handle non-chat game messages only
          switch (message.type) {
            case 'joined_game':
              console.log('joined hiLo game');
              break;
            case 'bet_confirmed':
              console.log('bet confirmed:', message);
              break;
            case 'bet_placed':
              console.log('bet placed by player:', message.userData?.username);
              break;
            case 'game_result':
              console.log('game result:', message);
              break;
          }
        },
        onError: (error) => {
          console.error('webSocket error in hiLo game:', error);
          setIsConnected(false);
        }
      });

      // If WebSocket was already connected, join the room immediately
      if (wasAlreadyConnected) {
        console.log('webSocket was already connected - joining hiLo room directly');
        setIsConnected(true);
        websocketService.joinGame('hi-lo', session.access_token);
      }

      // Cleanup on unmount
      return () => {
        console.log('hiLo component unmounting - leaving room');
        websocketService.leaveGame();
      };
    } else {
      console.log('hiLo component waiting for auth - user:', !!user, 'session:', !!session?.access_token, 'loading:', loading);
    }
  }, [user, session?.access_token, loading]);

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
    if (!isConnected) {
      console.log('Not connected to WebSocket');
      return;
    }

    if (bet > balance) {
      alert('Insufficient balance');
      return;
    }

    try {
      websocketService.placeBet(bet);
      console.log('Placed bet:', bet);
    } catch (error) {
      console.error('Error placing bet:', error);
    }
  };

  const handleGameAction = (action: string) => {
    if (!isConnected) {
      console.log('Not connected to WebSocket');
      return;
    }

    try {
      websocketService.sendGameAction(action);
      console.log('Sent game action:', action);
    } catch (error) {
      console.error('Error sending game action:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-xl">Loading Hi-Lo...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">🎲</div>
          <h2 className="text-3xl font-bold mb-4">Sign in to play hi-lo</h2>
          <p className="text-lg mb-8">Join our Discord community to start playing</p>
          <Link to="/">
            <LightButton>Go home</LightButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <GamemodeAccessCheck gamemode="hi-lo">
      <div className="min-h-screen bg-black">
        <div className="container mx-auto px-4 py-8 pt-16 sm:pt-20 md:pt-24">
        <div className="mb-8 mt-8 sm:mt-3 md:mt-4">
          <GameLiveView />
        </div>

        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:items-start">
            {/* Betting Controls */}
            <div className="h-full flex flex-col">
              <h3 className="text-white font-bold text-lg mb-4">Place your bet</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-white text-sm block mb-1">Bet amount:</label>
                  <div className="flex items-center space-x-2 w-full">
                    <button 
                      onClick={() => updateBet(Math.max(1, bet - 1))}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded transition-colors cursor-pointer flex-shrink-0"
                    >
                      -1
                    </button>
                    <input
                      type="number"
                      value={betInput}
                      onChange={(e) => handleBetInputChange(e.target.value)}
                      className="bg-gray-800 border border-gray-600 px-4 py-2 rounded text-center flex-1 text-yellow-400 font-bold focus:outline-none focus:border-yellow-400"
                      min="1"
                      placeholder="0"
                    />
                    <span className="text-gray-400 flex-shrink-0">GC</span>
                    <button 
                      onClick={() => updateBet(bet + 1)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded transition-colors cursor-pointer flex-shrink-0"
                    >
                      +1
                    </button>
                  </div>
                  
                  {/* Quick Bet Buttons */}
                  <div className="grid grid-cols-5 gap-1 mt-2">
                    <button onClick={() => updateBet(bet + 5)} className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs cursor-pointer">+5</button>
                    <button onClick={() => updateBet(bet + 10)} className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs cursor-pointer">+10</button>
                    <button onClick={() => updateBet(bet + 25)} className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs cursor-pointer">+25</button>
                    <button onClick={() => updateBet(bet + 50)} className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs cursor-pointer">+50</button>
                    <button onClick={() => updateBet(bet + 100)} className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs cursor-pointer">+100</button>
                  </div>
                </div>

                <div className="bg-gray-800 rounded p-4">
                  <div className="text-center space-y-2">
                    <div>
                      <span className="text-gray-400">Current streak: </span>
                      <span className="text-green-400 font-bold text-xl">{streak}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Multiplier: </span>
                      <span className="text-yellow-400 font-bold text-xl">{multiplier.toFixed(2)}x</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Potential win: </span>
                      <span className="text-white font-bold">{(bet * multiplier).toFixed(0)} GC</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Game Actions */}
            <div className="h-full flex flex-col">
              <h3 className="text-white font-bold text-lg mb-4">Make your guess</h3>
              <div className="space-y-3">
                <button 
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded font-semibold transition-colors text-lg cursor-pointer"
                  onClick={() => handleGameAction('higher')}
                >
                   Higher
                </button>
                <button 
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded font-semibold transition-colors text-lg cursor-pointer"
                  onClick={() => handleGameAction('lower')}
                >
                   Lower
                </button>
                <button 
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded font-semibold transition-colors cursor-pointer"
                  onClick={() => handleGameAction('cash_out')}
                >
                   Cash out
                 </button>
                 
                 <div className="bg-gray-800 rounded p-3" style={{ marginTop: '13px' }}>
                   <div className="text-center text-sm text-gray-400">
                     Next card will be compared to King ♥️
                   </div>
                 </div>
              </div>
            </div>

            {/* Game Status & Strategy */}
            <div className="h-full flex flex-col">
              <h3 className="text-white font-bold text-lg mb-4">Game stats</h3>
              <div className="space-y-4">
                {/* Collapsible Game Stats Card */}
                <div className="bg-gray-800 rounded overflow-hidden">
                  <button
                    onClick={() => setGameStatsExpanded(!gameStatsExpanded)}
                    className="w-full flex items-center justify-between p-4 text-white hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <span className="font-semibold">Current game info</span>
                    <svg 
                      className={`w-5 h-5 transition-transform duration-200 ${gameStatsExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className={`transition-all duration-200 overflow-hidden ${gameStatsExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-4 space-y-2 border-t border-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current card:</span>
                        <span className="text-white font-bold">King ♥️</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Card value:</span>
                        <span className="text-white font-bold">13</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Cards left:</span>
                        <span className="text-white font-bold">39</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Best streak:</span>
                        <span className="text-green-400 font-bold">8</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Multipliers Card */}
                <div className="bg-gray-800 rounded overflow-hidden">
                  <button
                    onClick={() => setMultipliersExpanded(!multipliersExpanded)}
                    className="w-full flex items-center justify-between p-4 text-white hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <span className="font-semibold">Game multipliers</span>
                    <svg 
                      className={`w-5 h-5 transition-transform duration-200 ${multipliersExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className={`transition-all duration-200 overflow-hidden ${multipliersExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-4 border-t border-gray-700">
                      <h4 className="text-white font-semibold mb-2">Streak multipliers</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>1-2 wins:</span>
                          <span className="text-yellow-400">1.5x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>3-5 wins:</span>
                          <span className="text-yellow-400">2.0x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>6-9 wins:</span>
                          <span className="text-yellow-400">3.0x</span>
                        </div>
                        <div className="flex justify-between">
                          <span>10+ wins:</span>
                          <span className="text-yellow-400">5.0x</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Chat */}
        <ChatSidebar gamemode="hi-lo" />
      </div>
    </div>
    </GamemodeAccessCheck>
  );
} 
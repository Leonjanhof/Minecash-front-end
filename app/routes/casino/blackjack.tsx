import type { Route } from "./+types/blackjack";
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
    { title: "Blackjack - MINECASH" },
    { name: "description", content: "Beat the dealer in our fair and exciting Blackjack game. 21 or bust!" },
  ];
}

// GameLiveView component placeholder for the main game interface
function GameLiveView() {
  return (
    <div className="w-full h-[500px] bg-[#F5F5F5] rounded-lg border-2 border-yellow-400 flex items-center justify-center">
      <div className="text-center text-black">
        <div className="text-6xl mb-4">♠️</div>
        <h3 className="text-2xl font-bold mb-2">Blackjack table</h3>
        <p className="text-lg opacity-80">Live game interface will appear here</p>
        <div className="mt-4 flex space-x-4 justify-center">
          <div className="bg-white rounded-lg w-16 h-24 flex items-center justify-center text-black font-bold">
            ?
          </div>
          <div className="bg-white rounded-lg w-16 h-24 flex items-center justify-center text-black font-bold">
            ?
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Blackjack() {
  const { user, loading, session } = useAuth();
  const { balance, updateBalance } = useGCBalance();
  const [bet, setBet] = useState(10);
  const [betInput, setBetInput] = useState("10");
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState('waiting'); // waiting, betting, playing, results

  // Connect to WebSocket when component mounts
  useEffect(() => {
    // Only proceed if user is fully loaded (not null and not loading)
    if (user && session?.access_token && !loading) {
      console.log('blackjack component setting up webSocket connection');
      
      // Check if already connected before setting up callbacks
      const wasAlreadyConnected = websocketService.isConnected();
      
      websocketService.connect({
        onConnect: () => {
          console.log('webSocket connected to blackjack game');
          setIsConnected(true);
          // Join the blackjack room with authentication token
          websocketService.joinGame('blackjack', session.access_token);
        },
        onDisconnect: () => {
          console.log('webSocket disconnected from blackjack game');
          setIsConnected(false);
        },
        onMessage: (message) => {
          // Handle non-chat game messages only
          switch (message.type) {
            case 'joined_game':
              console.log('joined blackjack game');
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
          console.error('webSocket error in blackjack game:', error);
          setIsConnected(false);
        }
      });

      // If WebSocket was already connected, join the room immediately
      if (wasAlreadyConnected) {
        console.log('webSocket was already connected - joining blackjack room directly');
        setIsConnected(true);
        websocketService.joinGame('blackjack', session.access_token);
      }

      // Cleanup on unmount
      return () => {
        console.log('blackjack component unmounting - leaving room');
        websocketService.leaveGame();
      };
    } else {
      console.log('blackjack component waiting for auth - user:', !!user, 'session:', !!session?.access_token, 'loading:', loading);
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
    if (!user || !isConnected) {
      console.log('User not authenticated or WebSocket not connected');
      return;
    }

    try {
      // Place bet via WebSocket
      websocketService.placeBet(bet);
      
      // Also update balance via API (for now)
      await updateBalance(-bet, 'game_loss', 'blackjack', 'temp-game-id', 'Blackjack bet');
      
      console.log(`Placed bet: ${bet} GC`);
    } catch (error) {
      console.error('Error placing bet:', error);
    }
  };

  const handleGameAction = (action: string) => {
    if (!isConnected) return;
    
    websocketService.sendGameAction(action);
    console.log(`Game action: ${action}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-xl">Loading blackjack...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">♠️</div>
          <h2 className="text-3xl font-bold mb-4">Sign in to play blackjack</h2>
          <p className="text-lg mb-8">Join our Discord community to start playing</p>
          <Link to="/">
            <LightButton>Go home</LightButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <GamemodeAccessCheck gamemode="blackjack">
      <div className="min-h-screen bg-black">
        <div className="container mx-auto px-4 py-8 pt-16 sm:pt-20 md:pt-24">
        <div className="mb-8 mt-8 sm:mt-3 md:mt-4">
          <GameLiveView />
        </div>

        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:items-stretch">
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
              </div>
            </div>

            {/* Game Actions */}
            <div className="h-full flex flex-col">
              <h3 className="text-white font-bold text-lg mb-4">Actions</h3>
              <div className="space-y-2">
                <GoldButton 
                  className="w-full" 
                  onClick={handlePlaceBet}
                  disabled={!isConnected}
                >
                  Deal
                </GoldButton>
                <button 
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold transition-colors cursor-pointer"
                  onClick={() => handleGameAction('hit')}
                  disabled={!isConnected}
                >
                  Hit
                </button>
                <button 
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold transition-colors cursor-pointer"
                  onClick={() => handleGameAction('stand')}
                  disabled={!isConnected}
                >
                  Stand
                </button>
                <button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold transition-colors cursor-pointer"
                  onClick={() => handleGameAction('double')}
                  disabled={!isConnected}
                >
                  Double
                </button>
              </div>
            </div>

            {/* Game Status */}
            <div className="h-full flex flex-col">
              <h3 className="text-white font-bold text-lg mb-4">Game status</h3>
              <div className="bg-gray-800 rounded p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Your balance:</span>
                  <span className="text-yellow-400 font-bold">{balance} GC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Current bet:</span>
                  <span className="text-white font-bold">{bet} GC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-yellow-400 font-bold">{gameState}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Potential win:</span>
                  <span className="text-white font-bold">{bet * 2} GC</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Chat */}
        <ChatSidebar gamemode="blackjack" />
      </div>
    </div>
    </GamemodeAccessCheck>
  );
} 
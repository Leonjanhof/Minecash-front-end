import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Types for Discord bot requests and responses
interface DiscordBotRequest {
  action: 'create_ticket' | 'check_user';
  userId: string;
  type?: 'deposit' | 'withdraw' | 'support';
  amount?: number;
  description?: string;
}

interface DiscordBotResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// Environment variables
const DISCORD_BOT_URL = Deno.env.get('DISCORD_BOT_URL') || 'https://minecash-discord-bot.onrender.com';
const DISCORD_BOT_SECRET = Deno.env.get('DISCORD_BOT_SECRET');

console.info('Discord bot function started');

// Main Edge Function handler
Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
      },
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Parse and validate request body
    const body: DiscordBotRequest = await req.json();
    const { action, userId, type, amount, description } = body;

    // Validate required fields
    if (!action || !userId) {
      return createErrorResponse('Missing required fields: action and userId', 400);
    }

    // Route to appropriate handler
    switch (action) {
      case 'check_user':
        return await handleCheckUser(userId);
      
      case 'create_ticket':
        if (!type) {
          return createErrorResponse('Ticket type required for create_ticket action', 400);
        }
        return await handleCreateTicket(userId, type, amount, description);
      
      default:
        return createErrorResponse('Invalid action', 400);
    }

  } catch (error) {
    console.error('Discord bot function error:', error);
    return createErrorResponse('Internal server error', 500);
  }
});

// Helper function to create error responses
function createErrorResponse(message: string, status: number): Response {
  const data = {
    success: false,
    error: message
  };

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
      },
    }
  );
}

// Helper function to create success responses
function createSuccessResponse(data: any, message: string = 'Success'): Response {
  const response = {
    success: true,
    message,
    data
  };

  return new Response(
    JSON.stringify(response),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
      },
    }
  );
}

// Handle user checking requests
async function handleCheckUser(userId: string): Promise<Response> {
  try {
    const response = await fetch(`${DISCORD_BOT_URL}/check-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DISCORD_BOT_SECRET}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      console.error('Discord bot server error:', response.status, response.statusText);
      return createErrorResponse('Failed to check user status', 500);
    }

    const result = await response.json();
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
        },
      }
    );
    
  } catch (error) {
    console.error('Error checking user:', error);
    return createErrorResponse('Failed to check user status', 500);
  }
}

// Handle ticket creation requests
async function handleCreateTicket(
  userId: string, 
  type: 'deposit' | 'withdraw' | 'support', 
  amount?: number, 
  description?: string
): Promise<Response> {
  try {
    const response = await fetch(`${DISCORD_BOT_URL}/create-ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DISCORD_BOT_SECRET}`,
      },
      body: JSON.stringify({ userId, type, amount, description }),
    });

    if (!response.ok) {
      console.error('Discord bot server error:', response.status, response.statusText);
      return createErrorResponse('Failed to create ticket', 500);
    }

    const result = await response.json();
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
        },
      }
    );
    
  } catch (error) {
    console.error('Error creating ticket:', error);
    return createErrorResponse('Failed to create ticket', 500);
  }
} 
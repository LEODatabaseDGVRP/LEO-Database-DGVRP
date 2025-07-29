
import axios from 'axios';

export interface DiscordOAuthService {
  getAuthUrl: (state: string) => string;
  exchangeCode: (code: string) => Promise<{ accessToken: string; user: DiscordUser }>;
  getUserGuilds: (accessToken: string) => Promise<DiscordGuild[]>;
  checkUserRole: (accessToken: string, guildId: string, requiredRole?: string) => Promise<boolean>;
  getUserDisplayName: (accessToken: string, guildId: string) => Promise<string | null>;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  email?: string;
  displayName?: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  permissions: string;
}

class DiscordOAuthServiceImpl implements DiscordOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private botToken: string;
  private requiredGuildId?: string;

  constructor(clientId: string, clientSecret: string, redirectUri: string, botToken: string, requiredGuildId?: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.botToken = botToken;
    this.requiredGuildId = requiredGuildId;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'identify guilds guilds.members.read',
      state: state,
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; user: DiscordUser }> {
    try {
      // Exchange code for access token
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token } = tokenResponse.data;

      // Get user info
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      return {
        accessToken: access_token,
        user: userResponse.data,
      };
    } catch (error) {
      console.error('Discord OAuth error:', error);
      throw new Error('Failed to authenticate with Discord');
    }
  }

  async getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
    try {
      const response = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get user guilds:', error);
      throw new Error('Failed to get Discord server list');
    }
  }

  async checkUserRole(accessToken: string, guildId: string, requiredRole?: string): Promise<boolean> {
    try {
      console.log("🔍 checkUserRole called with guildId:", guildId, "requiredRole:", requiredRole);
      
      // First check if user is in the guild
      const guilds = await this.getUserGuilds(accessToken);
      console.log("📋 User is in guilds:", guilds.map(g => `${g.name} (${g.id})`));
      
      const isInGuild = guilds.some(guild => guild.id === guildId);
      console.log("🔍 User is in target guild:", isInGuild);
      
      if (!isInGuild) {
        console.log("❌ User is not in the required guild");
        return false;
      }

      // If no specific role required, just being in the guild is enough
      if (!requiredRole) {
        console.log("✅ No specific role required - user is in guild");
        return true;
      }

      // Use bot token to get user's roles in the guild
      const userResponse = await axios.get(`https://discord.com/api/users/@me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const userId = userResponse.data.id;
      console.log("👤 User ID:", userId);

      // Get guild member info using bot token
      const memberResponse = await axios.get(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
        headers: {
          Authorization: `Bot ${this.botToken}`,
        },
      });

      const memberRoles = memberResponse.data.roles;
      console.log("🎭 User roles in guild:", memberRoles);

      // Get guild roles to find the required role ID
      const rolesResponse = await axios.get(`https://discord.com/api/guilds/${guildId}/roles`, {
        headers: {
          Authorization: `Bot ${this.botToken}`,
        },
      });

      const guildRoles = rolesResponse.data;
      console.log("📋 Available guild roles:", guildRoles.map((r: any) => `${r.name} (${r.id})`));
      
      const requiredRoleObj = guildRoles.find((role: any) => 
        role.name.toLowerCase() === requiredRole.toLowerCase()
      );

      if (!requiredRoleObj) {
        console.log(`❌ Required role "${requiredRole}" not found in guild`);
        return false;
      }

      console.log("🎯 Required role found:", requiredRoleObj.name, "ID:", requiredRoleObj.id);
      const hasRole = memberRoles.includes(requiredRoleObj.id);
      console.log("🔍 User has required role:", hasRole);

      return hasRole;
    } catch (error) {
      console.error('❌ Failed to check user role:', error);
      return false;
    }
  }

  async getUserDisplayName(accessToken: string, guildId: string): Promise<string | null> {
    try {
      console.log("🔍 Getting user display name for guild:", guildId);
      
      // Get user info to get their ID
      const userResponse = await axios.get(`https://discord.com/api/users/@me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const userId = userResponse.data.id;
      console.log("👤 User ID:", userId);

      // Get guild member info using bot token to get nickname/display name
      const memberResponse = await axios.get(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
        headers: {
          Authorization: `Bot ${this.botToken}`,
        },
      });

      // Discord nickname (display name) takes priority over username
      const displayName = memberResponse.data.nick || userResponse.data.username;
      console.log("📝 User display name:", displayName);
      
      return displayName;
    } catch (error) {
      console.error('❌ Failed to get user display name:', error);
      return null;
    }
  }
}

export function createDiscordOAuthService(
  clientId: string, 
  clientSecret: string, 
  redirectUri: string, 
  botToken: string, 
  requiredGuildId?: string
): DiscordOAuthService {
  return new DiscordOAuthServiceImpl(clientId, clientSecret, redirectUri, botToken, requiredGuildId);
}

// Create a default instance for easy use
const defaultService = createDiscordOAuthService(
  process.env.DISCORD_CLIENT_ID || '',
  process.env.DISCORD_CLIENT_SECRET || '',
  process.env.DISCORD_REDIRECT_URI || getDefaultRedirectUri(),
  process.env.DISCORD_BOT_TOKEN || '',
  process.env.DISCORD_GUILD_ID
);

function getDefaultRedirectUri(): string {
  // Check for Render deployment
  if (process.env.RENDER_EXTERNAL_URL) {
    return `${process.env.RENDER_EXTERNAL_URL}/api/auth/discord/callback`;
  }
  
  // Check for Replit deployment
  if (process.env.REPLIT_DOMAIN) {
    return `${process.env.REPLIT_DOMAIN}/api/auth/discord/callback`;
  }
  
  // Default to localhost for development
  return 'http://localhost:5000/api/auth/discord/callback';
}

// Export helper functions for easy access
export function getDiscordAuthUrl(mode: string): string {
  const state = `${mode}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  return defaultService.getAuthUrl(state);
}

export async function handleDiscordCallback(code: string, state: string): Promise<{ mode: string; user: DiscordUser }> {
  const [mode] = state.split('_');
  console.log("🔍 Discord callback - Mode:", mode, "State:", state);
  
  const { accessToken, user } = await defaultService.exchangeCode(code);
  console.log("✅ Discord user authenticated:", user.username, "ID:", user.id);
  
  // If we have a required guild, check if user is in it and has the required role
  if (process.env.DISCORD_GUILD_ID) {
    console.log("🔍 Checking user access to guild:", process.env.DISCORD_GUILD_ID);
    const requiredRole = process.env.DISCORD_REQUIRED_ROLE;
    console.log("🔍 Required role:", requiredRole);
    
    const hasAccess = await defaultService.checkUserRole(accessToken, process.env.DISCORD_GUILD_ID, requiredRole);
    console.log("🔍 User has access to guild with required role:", hasAccess);
    
    if (!hasAccess) {
      if (requiredRole) {
        console.log("❌ User does not have the required role '" + requiredRole + "' in the Discord server");
        throw new Error(`User does not have the required role '${requiredRole}' in the Discord server`);
      } else {
        console.log("❌ User is not a member of the required Discord server");
        throw new Error('User is not a member of the required Discord server');
      }
    }

    // Get the user's display name (nickname) in the server
    const displayName = await defaultService.getUserDisplayName(accessToken, process.env.DISCORD_GUILD_ID);
    if (displayName) {
      user.displayName = displayName;
      console.log("📝 Using display name:", displayName, "instead of username:", user.username);
    }
  } else {
    console.log("⚠️ No DISCORD_GUILD_ID set - skipping guild verification");
  }
  
  return { mode, user };
}

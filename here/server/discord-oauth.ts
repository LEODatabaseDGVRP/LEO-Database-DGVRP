
import axios from 'axios';

export interface DiscordOAuthService {
  getAuthUrl: (state: string) => string;
  exchangeCode: (code: string) => Promise<{ accessToken: string; user: DiscordUser }>;
  getUserGuilds: (accessToken: string) => Promise<DiscordGuild[]>;
  checkUserRole: (accessToken: string, guildId: string, requiredRole?: string) => Promise<boolean>;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  email?: string;
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
      // First check if user is in the guild
      const guilds = await this.getUserGuilds(accessToken);
      const isInGuild = guilds.some(guild => guild.id === guildId);
      
      if (!isInGuild) {
        return false;
      }

      // If no specific role required, just being in the guild is enough
      if (!requiredRole) {
        return true;
      }

      // Use bot token to get user's roles in the guild
      const userResponse = await axios.get(`https://discord.com/api/users/@me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const userId = userResponse.data.id;

      // Get guild member info using bot token
      const memberResponse = await axios.get(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
        headers: {
          Authorization: `Bot ${this.botToken}`,
        },
      });

      const memberRoles = memberResponse.data.roles;

      // Get guild roles to find the required role ID
      const rolesResponse = await axios.get(`https://discord.com/api/guilds/${guildId}/roles`, {
        headers: {
          Authorization: `Bot ${this.botToken}`,
        },
      });

      const guildRoles = rolesResponse.data;
      const requiredRoleObj = guildRoles.find((role: any) => 
        role.name.toLowerCase() === requiredRole.toLowerCase()
      );

      if (!requiredRoleObj) {
        console.log(`Required role "${requiredRole}" not found in guild`);
        return false;
      }

      return memberRoles.includes(requiredRoleObj.id);
    } catch (error) {
      console.error('Failed to check user role:', error);
      return false;
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

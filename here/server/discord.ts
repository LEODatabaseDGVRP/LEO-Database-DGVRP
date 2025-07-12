import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, AttachmentBuilder } from 'discord.js';

export interface DiscordBotService {
  sendCitationReport: (data: any) => Promise<void>;
  sendArrestReport: (data: any) => Promise<void>;
  initialize: () => Promise<void>;
  verifyUserInServer: (username: string, requiredRole?: string) => Promise<boolean>;
}

class DiscordBotServiceImpl implements DiscordBotService {
  private client: Client;
  private channelId: string;
  private isReady: boolean = false;

  constructor(token: string, channelId: string) {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });
    this.channelId = channelId;

    this.client.once('ready', () => {
      console.log(`Discord bot logged in as ${this.client.user?.tag}`);
      this.isReady = true;
    });

    this.client.login(token);
  }

  async initialize(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isReady) {
        resolve();
        return;
      }

      this.client.once('ready', () => {
        resolve();
      });
    });
  }

  async sendCitationReport(data: any): Promise<void> {
    if (!this.isReady) {
      await this.initialize();
    }

    const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
    if (!channel) {
      throw new Error('Discord channel not found');
    }

    console.log("📝 Formatting citation data:", data);

    // Format multiple officers - handle both array and single values
    let officerInfo = "";
    if (Array.isArray(data.officerBadges)) {
      officerInfo = data.officerBadges.map((badge: string, index: number) => {
        const rankText = data.officerRanks[index] || data.officerRanks[0] || "";
        const username = data.officerUsernames[index] || data.officerUsernames[0] || "";
        const userId = data.officerUserIds ? (data.officerUserIds[index] || data.officerUserIds[0] || "") : "";
        return `${rankText} @${username} (Badge #${badge})`;
      }).filter(info => info.trim() !== " @ (Badge #)").join('\n');
    } else {
      // Handle single officer case
      officerInfo = `${data.officerRanks || ""} @${data.officerUsernames || ""} (Badge #${data.officerBadges || ""})`;
    }

    // Format penal codes - just the codes without amounts
    let penalCodes = "";
    if (Array.isArray(data.penalCodes)) {
      penalCodes = data.penalCodes.map((code: string) => `**${code}**`).join(', ');
    } else {
      penalCodes = `**${data.penalCodes}**`;
    }

    // Format officer info without badge numbers for rank and signature - show full rank text with Discord mention
    let rankSignature = "";
    if (Array.isArray(data.officerRanks)) {
      rankSignature = data.officerRanks.map((rank: string, index: number) => {
        const userId = data.officerUserIds ? (data.officerUserIds[index] || "") : "";
        const cleanRank = rank.replace(/\s+\d+$/, '').trim();
        return userId ? `${cleanRank} <@${userId}>` : cleanRank;
      }).filter(rank => rank.trim() !== "").join('\n');
    } else {
      // Handle single officer case
      let cleanRank = data.officerRanks || "";
      const userId = data.officerUserIds ? (Array.isArray(data.officerUserIds) ? data.officerUserIds[0] : data.officerUserIds) : "";
      cleanRank = cleanRank.replace(/\s+\d+$/, '').trim();
      rankSignature = userId ? `${cleanRank} <@${userId}>` : cleanRank;
    }

    // Get the description for the first penal code to use as ticket type
    const penalCodeDescriptions = {
      "(2)08": "Petty Theft",
      "(2)15": "Loitering",
      "(4)11": "Misuse of Government Hotline",
      "(4)12": "Tampering with Evidence",
      "(5)01": "Disturbing the Peace",
      "(8)01": "Invalid / No Vehicle Registration / Insurance",
      "(8)02": "Driving Without a License",
      "(8)04": "Accident Reporting Requirements - Property Damage",
      "(8)06": "Failure to Obey Traffic Signal",
      "(8)07": "Driving Opposite Direction",
      "(8)08": "Failure to Maintain Lane",
      "(8)09": "Unsafe Following Distance",
      "(8)10": "Failure to Yield to Civilian",
      "(8)11": "Failure to Yield to Emergency Vehicles",
      "(8)12": "Unsafe Turn",
      "(8)13": "Unsafe Lane Change",
      "(8)14": "Illegal U-Turn",
      "(8)15": "Speeding (6-15 MPH Over)",
      "(8)16": "Speeding (16-25 MPH Over)",
      "(8)17": "Speeding (26+ MPH Over)",
      "(8)19": "Unreasonably Slow / Stopped",
      "(8)20": "Failure to Obey Stop Sign / RED LIGHT",
      "(8)21": "Illegally Parked",
      "(8)24": "Throwing Objects",
      "(8)31": "Littering",
      "(8)32": "Unsafe Speed for Conditions",
      "(8)33": "Hogging Passing Lane",
      "(8)34": "Impeding Traffic",
      "(8)35": "Jaywalking",
      "(8)36": "Unnecessary Use of Horn",
      "(8)37": "Excessive Music / Engine Sounds",
      "(8)39": "Failure to Yield to Pedestrian",
      "(8)40": "Distracted Driving",
      "(8)41": "Driving on Shoulder / Emergency Lane",
      "(8)42": "Move Over Law",
      "(8)43": "Driving Without Headlights",
      "(8)44": "Hit and Run",
      "(8)50": "Unroadworthy Vehicle",
      "(8)51": "Drifting on a Public Road",
      "(8)52": "Failure to Control Vehicle",
      "(8)53": "Unsafe Parking (Parking Ticket)",
      "(8)54": "Failure to Use Turn Signal",
      "(8)55": "Failure to Display License Plate (W/ only)"
    };

    // Get all penal codes to determine ticket type(s)
    let ticketType = "";
    if (Array.isArray(data.penalCodes)) {
      const ticketTypes = data.penalCodes.map((code: string) => 
        penalCodeDescriptions[code] || data.violationType || 'Citation'
      ).filter((type, index, arr) => arr.indexOf(type) === index); // Remove duplicates
      ticketType = ticketTypes.join(', ');
    } else {
      ticketType = penalCodeDescriptions[data.penalCodes] || data.violationType || 'Citation';
    }

    const formattedTotalAmount = parseFloat(data.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const citationMessage = `Ping User Receiving Ticket: <@${data.violatorUsername}>
Type of Ticket: **${ticketType}**
Penal Code: ${penalCodes}
Total Amount Due: **$${formattedTotalAmount}**
Additional Notes: **${data.additionalNotes || 'N/A'}**

Rank and Signature: **${rankSignature}**
Law Enforcement Name(s): **${Array.isArray(data.officerUsernames) ? data.officerUsernames.join(', ') : data.officerUsernames}**
Badge Number: **${Array.isArray(data.officerBadges) ? data.officerBadges.join(', ') : data.officerBadges}**

By signing this citation, you acknowledge that this is NOT an admission of guilt, it is to simply ensure the citation is taken care of. Your court date is shown below, and failure to show will result in a warrant for your arrest. If you have any questions, please contact a Supervisor.

You must pay the citation to <@1392657393724424313>

Sign at the X: <@${data.violatorSignature}>

4000 Capitol Drive, Greenville, Wisconsin 54942

Court date: XX/XX/XX
Please call (262) 785-4700 ext. 7 for further inquiry.`;

    console.log("📨 Sending citation message:", citationMessage);
    await channel.send(citationMessage);
  }

  async sendArrestReport(data: any): Promise<void> {
    if (!this.isReady) {
      await this.initialize();
    }

    const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
    if (!channel) {
      throw new Error('Discord channel not found');
    }

    // Format officer usernames with Discord pings
    const officerUsernames = data.officerUsernames.map((username: string, index: number) => {
      const userId = data.officerUserIds ? data.officerUserIds[index] : '';
      return userId ? `<@${userId}>` : `**${username}**`;
    }).join(', ');
    
    // Format ranks with bold formatting
    const officerRanks = data.officerRanks.map((rank: string) => `**${rank}**`).join(', ');
    
    // Format badge numbers with bold formatting
    const badgeNumbers = data.officerBadges.map((badge: string) => `**${badge}**`).join(', ');

    // Comprehensive penal code descriptions for arrest reports
    const arrestPenalCodeDescriptions = {
      // Section 1 - Crimes Against Persons
      "(1)01": "Criminal Threats",
      "(1)02": "Assault",
      "(1)03": "Battery",
      "(1)04": "Assault with a Deadly Weapon",
      "(1)05": "Attempted Murder",
      "(1)06": "Manslaughter",
      "(1)07": "Vehicular Manslaughter",
      "(1)08": "Murder",
      "(1)09": "Kidnapping",
      "(1)10": "Mayhem",
      "(1)11": "Torture",
      "(1)12": "Aggravated Assault",
      "(1)13": "Armed Robbery",
      "(1)14": "Unarmed Robbery",
      "(1)15": "Grand Theft Person",
      "(1)16": "Carjacking",
      "(1)17": "Rape",
      "(1)18": "Statutory Rape",
      "(1)19": "Lewd and Lascivious Acts with a Minor",
      "(1)20": "Indecent Exposure",
      "(1)21": "Prostitution",
      "(1)22": "Pandering/Pimping",
      "(1)23": "Sexual Battery",
      "(1)24": "Stalking",
      "(1)25": "Human Trafficking",

      // Section 2 - Crimes Against Property
      "(2)01": "Arson",
      "(2)02": "Vandalism/Defacing Property",
      "(2)03": "Trespassing",
      "(2)04": "Burglary",
      "(2)05": "Robbery",
      "(2)06": "Shoplifting",
      "(2)07": "Grand Theft",
      "(2)08": "Petty Theft",
      "(2)09": "Grand Theft Auto",
      "(2)10": "Joyriding",
      "(2)11": "Fraud",
      "(2)12": "Forgery",
      "(2)13": "Identity Theft",
      "(2)14": "Embezzlement",
      "(2)15": "Loitering",
      "(2)16": "Prowling",

      // Section 3 - Crimes Against Public Decency & Morals
      "(3)01": "Disturbing the Peace",
      "(3)02": "Disorderly Conduct",
      "(3)03": "Public Intoxication",
      "(3)04": "Under the Influence of a Controlled Substance",
      "(3)05": "Public Indecency",
      "(3)06": "Soliciting Prostitution",
      "(3)07": "Lewd Conduct",

      // Section 4 - Crimes Against Public Justice
      "(4)01": "Bribery",
      "(4)02": "Perjury",
      "(4)03": "Failure to Identify to a Peace Officer",
      "(4)04": "Impersonating a Public Official",
      "(4)05": "Impersonating a Peace Officer",
      "(4)06": "Filing a False Police Report",
      "(4)07": "False Information to a Peace Officer",
      "(4)08": "Accessory After the Fact",
      "(4)09": "Conspiracy",
      "(4)10": "Prisoner Breakout",
      "(4)11": "Misuse of Government Hotline",
      "(4)12": "Tampering with Evidence",
      "(4)13": "Introduction of Contraband",
      "(4)14": "False Arrest",
      "(4)15": "Assault on a Peace Officer",
      "(4)16": "Obstruction of Justice",
      "(4)17": "Disorderly Conduct",
      "(4)18": "Failure to Comply with a Lawful Order",
      "(4)19": "Aiding and Abetting",

      // Section 5 - Public Disturbance
      "(5)01": "Disturbing the Peace",
      "(5)02": "Unlawful Assembly",
      "(5)03": "Inciting Riot",

      // Section 6 - Drug Related
      "(6)04": "Maintaining a Place for the Purpose of Distribution",
      "(6)05": "Manufacture of a Controlled Substance",
      "(6)06": "Sale of a Controlled Substance",
      "(6)08": "Under the Influence of a Controlled Substance",
      "(6)09": "Detention of Mentally Disordered Persons",

      // Section 7 - Animal/Child
      "(7)01": "Animal Abuse / Cruelty",
      "(7)04": "Child Endangerment",

      // Section 8 - Traffic Violations
      "(8)01": "Invalid / No Vehicle Registration / Insurance",
      "(8)02": "Driving Without a License",
      "(8)03": "Driving With a Suspended or Revoked License",
      "(8)04": "Accident Reporting Requirements - Property Damage",
      "(8)05": "Accident Reporting Requirements - Injury or Death",
      "(8)06": "Failure to Obey Traffic Signal",
      "(8)07": "Driving Opposite Direction",
      "(8)08": "Failure to Maintain Lane",
      "(8)09": "Unsafe Following Distance",
      "(8)10": "Failure to Yield to Civilian",
      "(8)11": "Failure to Yield to Emergency Vehicles",
      "(8)12": "Unsafe Turn",
      "(8)13": "Unsafe Lane Change",
      "(8)14": "Illegal U-Turn",
      "(8)15": "Speeding (5-15 MPH Over)",
      "(8)16": "Speeding (16-25 MPH Over)",
      "(8)17": "Speeding (26+ MPH Over)",
      "(8)18": "Felony Speeding (100 MPH+)",
      "(8)19": "Unreasonably Slow / Stopped",
      "(8)20": "Failure to Obey Stop Sign / RED LIGHT",
      "(8)21": "Illegally Parked",
      "(8)22": "Reckless Driving",
      "(8)23": "Street Racing",
      "(8)24": "Throwing Objects",
      "(8)25": "Operating While Intoxicated",
      "(8)26": "Evading a Peace Officer",
      "(8)29": "Felony Evading a Peace Officer",
      "(8)30": "Road Rage",
      "(8)31": "Littering",
      "(8)32": "Unsafe Speed for Conditions",
      "(8)33": "Hogging Passing Lane",
      "(8)34": "Impeding Traffic",
      "(8)35": "Jaywalking",
      "(8)36": "Unnecessary Use of Horn",
      "(8)37": "Excessive Music / Engine Sounds",
      "(8)38": "Failure to Sign Citation",
      "(8)39": "Failure to Yield to Pedestrian",
      "(8)40": "Distracted Driving",
      "(8)41": "Driving on Shoulder / Emergency Lane",
      "(8)42": "Move Over Law",
      "(8)43": "Driving Without Headlights",
      "(8)44": "Hit and Run",
      "(8)45": "Attempted Vehicular Manslaughter",
      "(8)46": "Vehicular Manslaughter",
      "(8)47": "Reckless Evasion",
      "(8)48": "Possession of a Stolen Vehicle",
      "(8)49": "Reckless Endangerments",
      "(8)50": "Unroadworthy Vehicle",
      "(8)51": "Drifting on a Public Road",
      "(8)52": "Failure to Control Vehicle",
      "(8)53": "Unsafe Parking (Parking Ticket)",
      "(8)54": "Failure to Use Turn Signal",
      "(8)55": "Failure to Display License Plate (W/ only)",

      // Section 9 - Weapons
      "(9)01": "Possession of an Illegal Weapon",
      "(9)02": "Brandishing a Firearm",
      "(9)03": "Illegal Discharge of a Firearm",
      "(9)04": "Unlicensed Possession of a Firearm",
      "(9)05": "Possession of a Stolen Weapon",
      "(9)06": "Unlawful Distribution of a Firearm",
    };

    // Format penal codes with descriptions, jail time, and amounts
    const penalCodes = data.penalCodes.map((code: string, index: number) => {
      const description = arrestPenalCodeDescriptions[code] || "Unknown Offense";
      const jailTime = data.jailTimes[index];
      const amount = data.amountsDue[index];
      
      let line = `**${code}** - **${description}**`;
      if (jailTime && jailTime !== 'None') line += ` - **${jailTime}**`;
      if (amount && amount !== '0.00') {
        const formattedAmount = parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        line += ` - **$${formattedAmount}**`;
      }
      return line;
    }).join('\n');

    const formattedTotalAmount = parseFloat(data.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Format suspect signature as Discord ping if it's a valid user ID
    const suspectSignature = data.suspectSignature && data.suspectSignature.match(/^\d+$/) 
      ? `<@${data.suspectSignature}>` 
      : `**${data.suspectSignature}**`;
    
    // Format multiple officer signatures based on number of officers and their signatures
    const officerSignatures = data.officerSignatures.map((signature: string, index: number) => {
      const username = data.officerUsernames[index];
      const formattedSignature = signature && signature.match(/^\d+$/) ? `<@${signature}>` : `**${signature}**`;
      const title = index === 0 ? "Arresting officer signature X" : `Assisting officer #${index + 1} signature X`;
      return `${title}: ${formattedSignature}`;
    }).join('\n');
    
    // Calculate warrant information
    const remainingSeconds = !data.timeServed 
      ? parseInt((data.totalJailTime || "0 Seconds").replace(" Seconds", "")) || 0
      : 0;
    const warrantNeeded = remainingSeconds > 0 ? "**Yes**" : "**No**";
    const timeNeededForWarrant = remainingSeconds > 0 ? `**${remainingSeconds} Seconds**` : "**0 Seconds**";

    // Check if there's a mugshot but no description
    const shouldIncludeMugshot = data.mugshotBase64 && !data.description;
    
    // Update the description text based on whether we have an image
    const descriptionText = data.description || (shouldIncludeMugshot ? 'See attached mugshot' : 'No description provided');

    const arrestMessage = `**Arrest Report**

Officer's Username: ${officerUsernames}
Law Enforcement username(s): ${data.officerUsernames.map((username: string) => `**${username}**`).join(', ')}
Ranks: ${officerRanks}
Badge Number: ${badgeNumbers}

Description/Mugshot
**${descriptionText}**

—
Offense: 
${penalCodes}

Total: **$${formattedTotalAmount}** + **${data.totalJailTime}** ${data.timeServed ? '**(TIME SERVED)**' : ''}

**Warrant Information:**
Warrant Needed: ${warrantNeeded}
Time Needed for Warrant: ${timeNeededForWarrant}

Sign at the X:
${suspectSignature}

${officerSignatures}

${data.courtLocation}

Court date: **${data.courtDate}**
Please call **${data.courtPhone}** for further inquiry.`;

    console.log("📨 Sending arrest message:", arrestMessage);

    // Prepare message options
    const messageOptions: any = { content: arrestMessage };

    // Add image attachment if mugshot exists and no description
    if (shouldIncludeMugshot) {
      try {
        // Convert base64 to buffer
        const base64Data = data.mugshotBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Create attachment
        const attachment = new AttachmentBuilder(imageBuffer, { 
          name: 'mugshot.png',
          description: 'Arrest report mugshot'
        });
        
        messageOptions.files = [attachment];
        console.log("📸 Including mugshot attachment in arrest report");
      } catch (error) {
        console.error("❌ Failed to process mugshot image:", error);
        // Continue without the image if there's an error
      }
    }

    await channel.send(messageOptions);
  }

  async verifyUserInServer(discordId: string, requiredRole?: string): Promise<boolean> {
    try {
      if (!this.isReady) {
        await this.initialize();
      }

      // Get all guilds the bot is in
      const guilds = this.client.guilds.cache;
      
      for (const guild of guilds.values()) {
        try {
          // Try to fetch the user from this guild
          const member = await guild.members.fetch(discordId);
          
          if (member) {
            // User found in this guild
            if (!requiredRole) {
              // No specific role required, just need to be in server
              return true;
            }
            
            // Check if user has the required role
            const hasRole = member.roles.cache.some(role => 
              role.name.toLowerCase() === requiredRole.toLowerCase()
            );
            
            if (hasRole) {
              return true;
            }
          }
        } catch (error) {
          // User not found in this guild, continue to next
          continue;
        }
      }
      
      // User not found in any guild or doesn't have required role
      return false;
    } catch (error) {
      console.error('Error verifying user in Discord server:', error);
      return false;
    }
  }

}

export function createDiscordBotService(token: string, channelId: string): DiscordBotService {
  return new DiscordBotServiceImpl(token, channelId);
}
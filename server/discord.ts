import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, AttachmentBuilder } from 'discord.js';

export interface DiscordBotService {
  sendCitationReport: (data: any) => Promise<string>; // Return message ID
  sendArrestReport: (data: any) => Promise<string>; // Return message ID
  sendDirectMessage: (userId: string, message: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
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

  async sendCitationReport(data: any): Promise<string> {
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
    // Format violator username as Discord ping if it's a valid user ID
    const violatorPing = data.violatorUsername && data.violatorUsername.match(/^\d+$/) 
      ? `<@${data.violatorUsername}>` 
      : `**${data.violatorUsername}**`;

    // Format violator signature as Discord ping if it's a valid user ID
    const violatorSignaturePing = data.violatorSignature && data.violatorSignature.match(/^\d+$/) 
      ? `<@${data.violatorSignature}>` 
      : `**${data.violatorSignature}**`;

    const citationMessage = `Ping User Receiving Ticket: ${violatorPing}
Type of Ticket: **${ticketType}**
Penal Code: ${penalCodes}
Total Amount Due: **$${formattedTotalAmount}**
Additional Notes: **${data.additionalNotes || 'N/A'}**

Rank and Signature: **${rankSignature}**
Law Enforcement Name(s): **${Array.isArray(data.officerUsernames) ? data.officerUsernames.join(', ') : data.officerUsernames}**
Badge Number: **${Array.isArray(data.officerBadges) ? data.officerBadges.join(', ') : data.officerBadges}**

By signing this citation, you acknowledge that this is NOT an admission of guilt, it is to simply ensure the citation is taken care of. Your court date is shown below, and failure to show will result in a warrant for your arrest. If you have any questions, please contact a Supervisor.

You must pay the citation to <@1392657393724424313>

Sign at the X: ${violatorSignaturePing}

4000 Capitol Drive, Greenville, Wisconsin 54942

Court date: XX/XX/XX
Please call (262) 785-4700 ext. 7 for further inquiry.`;

    console.log("📨 Sending citation message:", citationMessage);
    const message = await channel.send(citationMessage);
    console.log("✅ Citation report sent to Discord successfully");
    return message.id;
  }

  async sendArrestReport(data: any): Promise<string> {
    if (!this.isReady) {
      await this.initialize();
    }

    const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
    if (!channel) {
      throw new Error('Discord channel not found');
    }

    // Get penal code descriptions
    const PENAL_CODE_OPTIONS = [
      // Section 1 - Criminal/Violence
      { code: "(1)01", description: "Criminal Threats", amount: "3750.00", jailTime: "60 Seconds" },
      { code: "(1)02", description: "Assault", amount: "3750.00", jailTime: "240 Seconds" },
      { code: "(1)03", description: "Assault with a Deadly Weapon", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(1)04", description: "Battery", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(1)05", description: "Aggravated Battery", amount: "0.00", jailTime: "120 Seconds" },
      { code: "(1)06", description: "Attempted Murder", amount: "10000.00", jailTime: "240 Seconds" },
      { code: "(1)07", description: "Manslaughter", amount: "0.00", jailTime: "270 Seconds" },
      { code: "(1)08", description: "Murder", amount: "0.00", jailTime: "600 Seconds" },
      { code: "(1)09", description: "False Imprisonment", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(1)10", description: "Kidnapping", amount: "0.00", jailTime: "210 Seconds" },
      { code: "(1)11", description: "Domestic Violence", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(1)12", description: "Domestic Violence (Physical Traumatic Injury)", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(1)13", description: "Assault on a Public Servant", amount: "1000.00", jailTime: "120 Seconds" },
      { code: "(1)14", description: "Attempted Assault on a Public Servant", amount: "1000.00", jailTime: "100 Seconds" },
      { code: "(1)15", description: "Assault on a Peace Officer", amount: "2000.00", jailTime: "180 Seconds" },

      // Section 2 - Property Crimes
      { code: "(2)01", description: "Arson", amount: "0.00", jailTime: "210 Seconds" },
      { code: "(2)02", description: "Trespassing", amount: "1000.00", jailTime: "15 Seconds" },
      { code: "(2)03", description: "Trespassing within a Restricted Facility", amount: "10000.00", jailTime: "60 Seconds" },
      { code: "(2)04", description: "Burglary", amount: "0.00", jailTime: "150 Seconds" },
      { code: "(2)05", description: "Possession of Burglary Tools", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(2)06", description: "Robbery", amount: "0.00", jailTime: "150 Seconds" },
      { code: "(2)07", description: "Armed Robbery", amount: "0.00", jailTime: "390 Seconds" },
      { code: "(2)08", description: "Petty Theft", amount: "1000.00", jailTime: "None" },
      { code: "(2)09", description: "Grand Theft", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(2)10", description: "Grand Theft Auto", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(2)11", description: "Receiving Stolen Property", amount: "10000.00", jailTime: "90 Seconds" },
      { code: "(2)12", description: "Extortion", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(2)13", description: "Forgery / Fraud", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(2)14", description: "Vandalism", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(2)15", description: "Loitering", amount: "1000.00", jailTime: "None" },
      { code: "(2)16", description: "Destruction of Civilian Property", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(2)17", description: "Destruction of Government Property", amount: "10000.00", jailTime: "120 Seconds" },

      // Section 3 - Public Order
      { code: "(3)01", description: "Lewd or Dissolute Conduct in Public", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(3)02", description: "Stalking", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(3)03", description: "Public Urination", amount: "0.00", jailTime: "120 Seconds" },
      { code: "(3)04", description: "Public Defecation", amount: "0.00", jailTime: "120 Seconds" },

      // Section 4 - Government/Law Enforcement
      { code: "(4)01", description: "Bribery", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(4)02", description: "Dissuading a Victim", amount: "0.00", jailTime: "60 Seconds" },
      { code: "(4)03", description: "False Information to a Peace Officer", amount: "0.00", jailTime: "30 Seconds" },
      { code: "(4)04", description: "Filing a False Police Report", amount: "0.00", jailTime: "60 Seconds" },
      { code: "(4)05", description: "Failure to Identify to a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(4)06", description: "Impersonation of a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(4)07", description: "Obstruction of a Peace Officer", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(4)08", description: "Resisting a Peace Officer", amount: "1000.00", jailTime: "120 Seconds" },
      { code: "(4)09", description: "Escape from Custody", amount: "1000.00", jailTime: "210 Seconds" },
      { code: "(4)10", description: "Prisoner Breakout", amount: "10000.00", jailTime: "90 Seconds" },
      { code: "(4)11", description: "Misuse of Government Hotline", amount: "1000.00", jailTime: "None" },
      { code: "(4)12", description: "Tampering with Evidence", amount: "1000.00", jailTime: "None" },
      { code: "(4)13", description: "Introduction of Contraband", amount: "0.00", jailTime: "120 Seconds" },
      { code: "(4)14", description: "False Arrest", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(4)15", description: "Assault on a Peace Officer", amount: "2000.00", jailTime: "180 Seconds" },
      { code: "(4)16", description: "Obstruction of Justice", amount: "500.00", jailTime: "60 Seconds" },
      { code: "(4)17", description: "Disorderly Conduct", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(4)18", description: "Failure to Comply with a Lawful Order", amount: "500.00", jailTime: "60 Seconds" },
      { code: "(4)19", description: "Aiding and Abetting", amount: "0.00", jailTime: "90 Seconds" },

      // Section 5 - Public Disturbance
      { code: "(5)01", description: "Disturbing the Peace", amount: "500.00", jailTime: "None" },
      { code: "(5)02", description: "Unlawful Assembly", amount: "0.00", jailTime: "90 Seconds" },
      { code: "(5)03", description: "Inciting Riot", amount: "1000.00", jailTime: "120 Seconds" },

      // Section 6 - Drug Related
      { code: "(6)04", description: "Maintaining a Place for the Purpose of Distribution", amount: "10000.00", jailTime: "90 Seconds" },
      { code: "(6)05", description: "Manufacture of a Controlled Substance", amount: "50000.00", jailTime: "180 Seconds" },
      { code: "(6)06", description: "Sale of a Controlled Substance", amount: "5000.00", jailTime: "180 Seconds" },
      { code: "(6)08", description: "Under the Influence of a Controlled Substance", amount: "2000.00", jailTime: "180 Seconds" },
      { code: "(6)09", description: "Detention of Mentally Disordered Persons", amount: "0.00", jailTime: "180 Seconds" },

      // Section 7 - Animal/Child
      { code: "(7)01", description: "Animal Abuse / Cruelty", amount: "20000.00", jailTime: "90 Seconds" },
      { code: "(7)04", description: "Child Endangerment", amount: "10000.00", jailTime: "60 Seconds" },

      // Section 8 - Traffic Violations
      { code: "(8)01", description: "Invalid / No Vehicle Registration / Insurance", amount: "200.00", jailTime: "None" },
      { code: "(8)02", description: "Driving Without a License", amount: "1000.00", jailTime: "None" },
      { code: "(8)03", description: "Driving With a Suspended or Revoked License", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(8)04", description: "Accident Reporting Requirements - Property Damage", amount: "1000.00", jailTime: "None" },
      { code: "(8)05", description: "Accident Reporting Requirements - Injury or Death", amount: "10000.00", jailTime: "120 Seconds" },
      { code: "(8)06", description: "Failure to Obey Traffic Signal", amount: "250.00", jailTime: "None" },
      { code: "(8)07", description: "Driving Opposite Direction", amount: "500.00", jailTime: "None" },
      { code: "(8)08", description: "Failure to Maintain Lane", amount: "250.00", jailTime: "None" },
      { code: "(8)09", description: "Unsafe Following Distance", amount: "250.00", jailTime: "None" },
      { code: "(8)10", description: "Failure to Yield to Civilian", amount: "250.00", jailTime: "None" },
      { code: "(8)11", description: "Failure to Yield to Emergency Vehicles", amount: "250.00", jailTime: "None" },
      { code: "(8)12", description: "Unsafe Turn", amount: "250.00", jailTime: "None" },
      { code: "(8)13", description: "Unsafe Lane Change", amount: "250.00", jailTime: "None" },
      { code: "(8)14", description: "Illegal U-Turn", amount: "250.00", jailTime: "None" },
      { code: "(8)15", description: "Speeding (5-15 MPH Over)", amount: "250.00", jailTime: "None" },
      { code: "(8)16", description: "Speeding (16-25 MPH Over)", amount: "360.00", jailTime: "None" },
      { code: "(8)17", description: "Speeding (26+ MPH Over)", amount: "500.00", jailTime: "None" },
      { code: "(8)18", description: "Felony Speeding (100 MPH+)", amount: "5000.00", jailTime: "30 Seconds" },
      { code: "(8)19", description: "Unreasonably Slow / Stopped", amount: "250.00", jailTime: "None" },
      { code: "(8)20", description: "Failure to Obey Stop Sign / RED LIGHT", amount: "250.00", jailTime: "None" },
      { code: "(8)21", description: "Illegally Parked", amount: "250.00", jailTime: "None" },
      { code: "(8)22", description: "Reckless Driving", amount: "1000.00", jailTime: "30 Seconds" },
      { code: "(8)23", description: "Street Racing", amount: "1000.00", jailTime: "30 Seconds" },
      { code: "(8)24", description: "Throwing Objects", amount: "1000.00", jailTime: "None" },
      { code: "(8)25", description: "Operating While Intoxicated", amount: "2000.00", jailTime: "60 Seconds" },
      { code: "(8)26", description: "Evading a Peace Officer", amount: "0.00", jailTime: "270 Seconds" },
      { code: "(8)29", description: "Felony Evading a Peace Officer", amount: "0.00", jailTime: "300 Seconds" },
      { code: "(8)30", description: "Road Rage", amount: "0.00", jailTime: "30 Seconds" },
      { code: "(8)31", description: "Littering", amount: "1000.00", jailTime: "None" },
      { code: "(8)32", description: "Unsafe Speed for Conditions", amount: "2000.00", jailTime: "None" },
      { code: "(8)33", description: "Hogging Passing Lane", amount: "250.00", jailTime: "None" },
      { code: "(8)34", description: "Impeding Traffic", amount: "250.00", jailTime: "None" },
      { code: "(8)35", description: "Jaywalking", amount: "250.00", jailTime: "None" },
      { code: "(8)36", description: "Unnecessary Use of Horn", amount: "400.00", jailTime: "None" },
      { code: "(8)37", description: "Excessive Music / Engine Sounds", amount: "400.00", jailTime: "None" },
      { code: "(8)38", description: "Failure to Sign Citation", amount: "250.00", jailTime: "30 Seconds" },
      { code: "(8)39", description: "Failure to Yield to Pedestrian", amount: "250.00", jailTime: "None" },
      { code: "(8)40", description: "Distracted Driving", amount: "1000.00", jailTime: "None" },
      { code: "(8)41", description: "Driving on Shoulder / Emergency Lane", amount: "250.00", jailTime: "None" },
      { code: "(8)42", description: "Move Over Law", amount: "1000.00", jailTime: "None" },
      { code: "(8)43", description: "Driving Without Headlights", amount: "250.00", jailTime: "None" },
      { code: "(8)44", description: "Hit and Run", amount: "500.00", jailTime: "None" },
      { code: "(8)45", description: "Attempted Vehicular Manslaughter", amount: "750.00", jailTime: "60 Seconds" },
      { code: "(8)46", description: "Vehicular Manslaughter", amount: "750.00", jailTime: "120 Seconds" },
      { code: "(8)47", description: "Reckless Evasion", amount: "750.00", jailTime: "120 Seconds" },
      { code: "(8)48", description: "Possession of a Stolen Vehicle", amount: "0.00", jailTime: "120 Seconds" },
      { code: "(8)49", description: "Reckless Endangerments", amount: "1000.00", jailTime: "60 Seconds" },
      { code: "(8)50", description: "Unroadworthy Vehicle", amount: "1000.00", jailTime: "None" },
      { code: "(8)51", description: "Drifting on a Public Road", amount: "250.00", jailTime: "None" },
      { code: "(8)52", description: "Failure to Control Vehicle", amount: "250.00", jailTime: "None" },
      { code: "(8)53", description: "Unsafe Parking (Parking Ticket)", amount: "100.00", jailTime: "None" },
      { code: "(8)54", description: "Failure to Use Turn Signal", amount: "100.00", jailTime: "None" },
      { code: "(8)55", description: "Failure to Display License Plate (W/ only)", amount: "300.00", jailTime: "None" }
    ];

    // Format multiple officers
    const officerUsernames = Array.isArray(data.officerUsernames) 
      ? data.officerUsernames.join(', ') 
      : data.officerUsernames || 'N/A';

    const officerRanks = Array.isArray(data.officerRanks) 
      ? data.officerRanks.join(', ') 
      : data.officerRanks || 'N/A';

    const badgeNumbers = Array.isArray(data.officerBadges) 
      ? data.officerBadges.join(', ') 
      : data.officerBadges || 'N/A';

    // Format officer signatures with Discord pings
    let officerSignatures = "";
    if (Array.isArray(data.officerUserIds)) {
      officerSignatures = data.officerUserIds.map((userId: string, index: number) => {
        const rank = data.officerRanks[index] || data.officerRanks[0] || "";
        const cleanRank = rank.replace(/\s+\d+$/, '').trim();
        return userId ? `${cleanRank} <@${userId}>` : cleanRank;
      }).filter(sig => sig.trim() !== "").join('\n');
    } else {
      const userId = data.officerUserIds || "";
      let cleanRank = data.officerRanks || "";
      cleanRank = cleanRank.replace(/\s+\d+$/, '').trim();
      officerSignatures = userId ? `${cleanRank} <@${userId}>` : cleanRank;
    }

    // Format suspect signature with Discord ping
    const suspectSignature = data.suspectSignature && data.suspectSignature.match(/^\d+$/) 
      ? `<@${data.suspectSignature}>` 
      : `**${data.suspectSignature || 'N/A'}**`;

    // Format penal codes with descriptions, jail time, and amounts
    const penalCodes = data.penalCodes.map((code: string, index: number) => {
      const description = PENAL_CODE_OPTIONS.find(option => option.code === code)?.description || "Unknown Offense";
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

    // Calculate warrant information based on time served
    const totalJailTimeSeconds = parseInt((data.totalJailTime || "0 Seconds").replace(" Seconds", "")) || 0;
    const actualTotalTime = data.jailTimes.reduce((total: number, timeStr: string) => {
      const seconds = parseInt(timeStr.replace(" Seconds", "")) || 0;
      return total + seconds;
    }, 0);

    // Calculate warrant information based on time served
    const finalSentenceSeconds = parseInt((data.totalJailTime || "0 Seconds").replace(" Seconds", "")) || 0;
    const warrantNeeded = data.timeServed ? "No" : (finalSentenceSeconds > 0 ? "Yes" : "No");
    const warrantTime = data.timeServed ? "N/A" : (finalSentenceSeconds > 0 ? data.totalJailTime : "N/A");

    const warrantInformation = `Warrant Information:
Warrant Needed: ${warrantNeeded}
Time Needed for Warrant: ${warrantTime}
`;

    // Check if there's a mugshot but no description
    const shouldIncludeMugshot = data.mugshotBase64 && !data.description;

    // Update the description text based on whether we have an image
    const descriptionText = data.description || (shouldIncludeMugshot ? 'See attached mugshot' : 'No description provided');

    // Format officer signatures with proper numbering
    let formattedOfficerSignatures = "";
    if (Array.isArray(data.officerUserIds)) {
      formattedOfficerSignatures = data.officerUserIds.map((userId: string, index: number) => {
        const rank = data.officerRanks[index] || data.officerRanks[0] || "";
        const cleanRank = rank.replace(/\s+\d+$/, '').trim();
        const signature = userId ? `<@${userId}>` : cleanRank;
        return `Arresting officer #${index + 1} signature X: ${signature}`;
      }).filter(sig => sig.trim() !== "").join('\n');
    } else {
      const userId = data.officerUserIds || "";
      let cleanRank = data.officerRanks || "";
      cleanRank = cleanRank.replace(/\s+\d+$/, '').trim();
      const signature = userId ? `<@${userId}>` : cleanRank;
      formattedOfficerSignatures = `Arresting officer #1 signature X: ${signature}`;
    }

    const arrestMessage = `**Arrest Report**

Officer's Username: ${officerSignatures}
Law Enforcement username(s): ${data.officerUsernames.map((username: string) => `**${username}**`).join(', ')}
Ranks: **${officerRanks}**
Badge Number: **${badgeNumbers}**

Description/Mugshot
**${descriptionText}**

—
Offense: 
${penalCodes}

Total: **$${formattedTotalAmount}** + **${actualTotalTime} Seconds** ${data.timeServed ? '**(TIME SERVED)**' : ''}

Warrant Information:
Warrant Needed: **${warrantNeeded}**
Time Needed for Warrant: **${warrantTime}**

Sign at the X:
${suspectSignature}

${formattedOfficerSignatures}

${data.courtLocation}

Court date: **${data.courtDate}**
Please call **${data.courtPhone}** for further inquiry.`;

    console.log("📨 Sending arrest message:", arrestMessage);

    // Prepare message options
    const messageOptions: any = { content: arrestMessage };

    // Add mugshot as attachment if provided
    if (data.mugshotBase64) {
      try {
        // Remove data URL prefix if present
        const base64Data = data.mugshotBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const attachment = new AttachmentBuilder(buffer, { name: 'mugshot.png' });
        messageOptions.files = [attachment];
      } catch (error) {
        console.error("Failed to process mugshot attachment:", error);
        // Continue without attachment
      }
    }

    const message = await channel.send(messageOptions);
    console.log("✅ Arrest report sent to Discord successfully");
    return message.id;
  }

  async deleteMessage(messageId: string): Promise<void> {
    if (!this.isReady) {
      await this.initialize();
    }

    try {
      const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
      if (!channel) {
        throw new Error('Discord channel not found');
      }

      const message = await channel.messages.fetch(messageId);
      if (message) {
        await message.delete();
        console.log(`✅ Discord message ${messageId} deleted successfully`);
      }
    } catch (error: any) {
      // Handle "Unknown Message" error (message already deleted or doesn't exist)
      if (error.code === 10008) {
        console.log(`ℹ️ Discord message ${messageId} was already deleted or doesn't exist`);
        return; // Don't throw error for already deleted messages
      }

      console.error(`❌ Failed to delete Discord message ${messageId}:`, error);
      throw new Error(`Failed to delete Discord message: ${messageId}`);
    }
  }

  async sendPasswordResetCode(discordId: string, resetCode: string): Promise<void> {
    try {
      const user = await this.client.users.fetch(discordId);

      const embed = {
        title: "🔐 Password Reset Request",
        description: `Your password reset code is: **${resetCode}**\n\nThis code will expire in 15 minutes.`,
        color: 0x3B82F6,
        timestamp: new Date().toISOString(),
        footer: {
          text: "Law Enforcement System"
        }
      };

      await user.send({ embeds: [embed] });
    } catch (error) {
      console.error("Failed to send password reset code:", error);
      throw new Error("Failed to send password reset code to Discord");
    }
  }

  async sendShiftLog(shiftData: any): Promise<string> {
    if (!this.isReady) {
      await this.initialize();
    }

    const channel = await this.client.channels.fetch(this.channelId) as TextChannel;
    if (!channel) {
      throw new Error('Discord channel not found');
    }
    try {
      // Format officers list
      const officersText = shiftData.officers?.map((officer: any, index: number) => 
        `**Officer ${index + 1}:** ${officer.username} - Badge #${officer.badgeNumber} - ${officer.rank}`
      ).join('\n') || "Not provided";

      const embed = {
        title: "📋 Shift Log Report",
        color: 0x10B981,
        fields: [
          {
            name: "Officers",
            value: officersText,
            inline: false
          },
          {
            name: "Callsign",
            value: shiftData.callsign || "Not provided",
            inline: true
          },
          {
            name: "Shift Duration",
            value: shiftData.shiftDuration || "Not provided",
            inline: true
          },
          {
            name: "Traffic Stops",
            value: shiftData.trafficStops || "0",
            inline: true
          },
          {
            name: "Citations",
            value: shiftData.citations || "0",
            inline: true
          },
          {
            name: "Arrests",
            value: shiftData.arrests || "0",
            inline: true
          },
          {
            name: "Additional Notes",
            value: shiftData.additionalNotes || "None",
            inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "Law Enforcement System - Shift Log"
        }
      };

      const message = await channel.send({ embeds: [embed] });
      return message.id;
    } catch (error) {
      console.error("Failed to send shift log to Discord:", error);
      throw new Error("Failed to send shift log to Discord");
    }
  }

  async sendDirectMessage(userId: string, message: string): Promise<void> {
    if (!this.isReady) {
      await this.initialize();
    }

    try {
      const user = await this.client.users.fetch(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      await user.send(message);
      console.log(`✅ Direct message sent to Discord user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to send direct message to ${userId}:`, error);
      throw new Error(`Failed to send direct message via Discord: ${userId}`);
    }
  }

  async verifyUserInServer(username: string, requiredRole?: string): Promise<boolean> {
    if (!this.isReady) {
      await this.initialize();
    }

    try {
      const guild = this.client.guilds.cache.first();
      if (!guild) {
        console.warn('No guild found. Ensure the bot is added to a server.');
        return false;
      }

      const user = guild.members.cache.find(member => member.user.username === username);
      if (!user) {
        console.warn(`User not found in the server: ${username}`);
        return false;
      }

      if (requiredRole) {
        const role = guild.roles.cache.find(role => role.name === requiredRole);
        if (!role) {
          console.warn(`Required role not found: ${requiredRole}`);
          return false;
        }

        if (!user.roles.cache.has(role.id)) {
          console.warn(`User does not have the required role: ${username}`);
          return false;
        }
      }

      console.log(`✅ User ${username} verified in the server.`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to verify user in server:`, error);
      return false;
    }
  }
}

export function createDiscordBotService(token: string, channelId: string): DiscordBotService {
  return new DiscordBotServiceImpl(token, channelId);
}
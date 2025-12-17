// ═══════════════════════════════════════════════════════════════
// 🤖 TERANGA BLOX RP - BOT DISCORD WHITELIST SIMPLE
// ═══════════════════════════════════════════════════════════════

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// ⚙️ CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
	BOT_TOKEN: process.env.BOT_TOKEN,
	GUILD_ID: process.env.GUILD_ID,
	ROLE_NAME: process.env.ROLE_NAME || 'CITOYEN',
	LOG_CHANNEL: process.env.LOG_CHANNEL || 'whitelist-logs',
	API_KEY: process.env.API_KEY,
	PORT: process.env.PORT || 10000,
};

// ═══════════════════════════════════════════════════════════════
// 📂 STOCKAGE SIMPLE
// ═══════════════════════════════════════════════════════════════

const DATA_FILE = path.join(__dirname, 'whitelist.json');

function loadWhitelist() {
	if (!fs.existsSync(DATA_FILE)) {
		return {};
	}
	try {
		return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
	} catch (error) {
		console.error('❌ Erreur lecture whitelist:', error);
		return {};
	}
}

function saveWhitelist(data) {
	try {
		fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
	} catch (error) {
		console.error('❌ Erreur sauvegarde whitelist:', error);
	}
}

// ═══════════════════════════════════════════════════════════════
// 🤖 CLIENT DISCORD
// ═══════════════════════════════════════════════════════════════

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

let guild = null;
let whitelistRole = null;
let logsChannel = null;
let awaitingIdFrom = new Map(); // Stock qui attend de donner un ID

// ═══════════════════════════════════════════════════════════════
// 📊 FONCTION: Envoyer logs
// ═══════════════════════════════════════════════════════════════

function sendLog(title, description, color, fields = []) {
	if (!logsChannel) return;

	const embed = new EmbedBuilder()
		.setTitle(title)
		.setDescription(description)
		.setColor(color)
		.setTimestamp();

	if (fields && fields.length > 0) {
		const validFields = fields.filter(f => f && f.name && f.value);
		if (validFields.length > 0) {
			embed.addFields(validFields);
		}
	}

	logsChannel.send({ embeds: [embed] }).catch(console.error);
}

// ═══════════════════════════════════════════════════════════════
// ✅ BOT PRÊT
// ═══════════════════════════════════════════════════════════════

client.once('ready', async () => {
	console.log(`✅ Bot connecté : ${client.user.tag}`);

	guild = client.guilds.cache.get(CONFIG.GUILD_ID);
	if (!guild) {
		console.error('❌ Guild introuvable !');
		return;
	}

	whitelistRole = guild.roles.cache.find(role => role.name === CONFIG.ROLE_NAME);
	if (!whitelistRole) {
		console.error(`❌ Rôle "${CONFIG.ROLE_NAME}" introuvable !`);
	} else {
		console.log(`✅ Rôle trouvé : @${whitelistRole.name}`);
	}

	logsChannel = guild.channels.cache.find(ch => ch.name === CONFIG.LOG_CHANNEL);
	if (!logsChannel) {
		console.warn(`⚠️ Salon "${CONFIG.LOG_CHANNEL}" introuvable`);
	} else {
		console.log(`✅ Logs : #${logsChannel.name}`);
	}

	// Auto-whitelist membres existants
	await autoWhitelistExisting();
});

// ═══════════════════════════════════════════════════════════════
// 🔄 AUTO-WHITELIST: Membres existants avec rôle
// ═══════════════════════════════════════════════════════════════

async function autoWhitelistExisting() {
	if (!guild || !whitelistRole) return;

	const whitelist = loadWhitelist();
	let count = 0;

	try {
		await guild.members.fetch();

		for (const [memberId, member] of guild.members.cache) {
			if (member.roles.cache.has(whitelistRole.id)) {
				// Si déjà dans whitelist, juste mettre à jour hasRole
				if (whitelist[memberId]) {
					whitelist[memberId].hasRole = true;
				}
				// Sinon, on NE FAIT RIEN (staff devra lier manuellement)
				count++;
			}
		}

		saveWhitelist(whitelist);
		console.log(`📊 ${count} membre(s) avec rôle @${CONFIG.ROLE_NAME}`);
		console.log(`📊 ${Object.keys(whitelist).length} membre(s) liés`);

	} catch (error) {
		console.error('❌ Erreur auto-whitelist:', error);
	}
}

// ═══════════════════════════════════════════════════════════════
// 👤 ÉVÉNEMENT: Rôle ajouté ou retiré
// ═══════════════════════════════════════════════════════════════

client.on('guildMemberUpdate', async (oldMember, newMember) => {
	if (!whitelistRole) return;

	const hadRole = oldMember.roles.cache.has(whitelistRole.id);
	const hasRoleNow = newMember.roles.cache.has(whitelistRole.id);

	// Rien n'a changé
	if (hadRole === hasRoleNow) return;

	const whitelist = loadWhitelist();
	const userId = newMember.id;

	// ═══════════════════════════════════════════════════════════
	// ✅ RÔLE AJOUTÉ
	// ═══════════════════════════════════════════════════════════

	if (hasRoleNow && !hadRole) {
		console.log(`✅ Rôle ajouté à ${newMember.user.tag}`);

		// Vérifier si déjà lié
		if (whitelist[userId] && whitelist[userId].robloxId) {
			// Déjà lié ! Juste réactiver
			whitelist[userId].hasRole = true;
			saveWhitelist(whitelist);

			sendLog(
				'✅ Rôle redonné',
				`${newMember.user.tag} a retrouvé le rôle`,
				0x00FF00,
				[
					{ name: 'Discord', value: newMember.user.tag, inline: true },
					{ name: 'Roblox ID', value: whitelist[userId].robloxId, inline: true },
					{ name: 'Statut', value: '✅ Déjà lié', inline: true }
				]
			);

			console.log(`✅ ${newMember.user.tag} déjà lié à ${whitelist[userId].robloxId}`);
			return;
		}

		// Pas encore lié ! Demander l'ID
		if (logsChannel) {
			const embed = new EmbedBuilder()
				.setTitle('🆕 Nouveau membre à lier')
				.setDescription(`${newMember.user.tag} a reçu le rôle @${CONFIG.ROLE_NAME}`)
				.setColor(0xFFAA00)
				.addFields([
					{ name: '👤 Membre', value: newMember.user.tag, inline: true },
					{ name: '🆔 Discord ID', value: userId, inline: true },
					{ name: '📝 Action requise', value: 'Tapez l\'ID Roblox de ce joueur dans ce salon', inline: false }
				])
				.setFooter({ text: 'Format: Juste le numéro ID (ex: 123456789)' });

			logsChannel.send({ embeds: [embed] });

			// Marquer qu'on attend un ID pour ce membre
			awaitingIdFrom.set(userId, {
				tag: newMember.user.tag,
				timestamp: Date.now()
			});

			console.log(`⏳ En attente de l'ID Roblox pour ${newMember.user.tag}`);
		}
	}

	// ═══════════════════════════════════════════════════════════
	// ❌ RÔLE RETIRÉ
	// ═══════════════════════════════════════════════════════════

	if (hadRole && !hasRoleNow) {
		console.log(`❌ Rôle retiré à ${newMember.user.tag}`);

		if (whitelist[userId]) {
			whitelist[userId].hasRole = false;
			saveWhitelist(whitelist);

			sendLog(
				'❌ Rôle retiré',
				`${newMember.user.tag} n'a plus le rôle`,
				0xFF0000,
				[
					{ name: 'Discord', value: newMember.user.tag, inline: true },
					{ name: 'Roblox ID', value: whitelist[userId].robloxId || 'Non lié', inline: true },
					{ name: 'Statut', value: '❌ Désactivé', inline: true }
				]
			);
		}
	}
});

// ═══════════════════════════════════════════════════════════════
// 💬 ÉVÉNEMENT: Message (pour recevoir l'ID Roblox)
// ═══════════════════════════════════════════════════════════════

client.on('messageCreate', async (message) => {
	// Ignorer bots
	if (message.author.bot) return;

	// Seulement dans le salon logs
	if (!logsChannel || message.channel.id !== logsChannel.id) return;

	// Seulement si on attend des IDs
	if (awaitingIdFrom.size === 0) return;

	const content = message.content.trim();

	// Vérifier si c'est un ID Roblox (que des chiffres, 6-12 caractères)
	if (!/^\d{6,12}$/.test(content)) return;

	const robloxId = content;

	// Trouver le membre le plus récent en attente
	let targetUserId = null;
	let oldestTime = Date.now();

	for (const [userId, data] of awaitingIdFrom.entries()) {
		if (data.timestamp < oldestTime) {
			oldestTime = data.timestamp;
			targetUserId = userId;
		}
	}

	if (!targetUserId) return;

	const targetData = awaitingIdFrom.get(targetUserId);
	awaitingIdFrom.delete(targetUserId);

	// Vérifier si cet ID est déjà utilisé
	const whitelist = loadWhitelist();
	const existingUser = Object.entries(whitelist).find(
		([discordId, data]) => data.robloxId === robloxId
	);

	if (existingUser) {
		const embed = new EmbedBuilder()
			.setTitle('⚠️ ID déjà utilisé')
			.setDescription(`L'ID Roblox ${robloxId} est déjà lié`)
			.setColor(0xFF6600)
			.addFields([
				{ name: 'Roblox ID', value: robloxId, inline: true },
				{ name: 'Déjà lié à', value: whitelist[existingUser[0]].tag, inline: true }
			]);

		logsChannel.send({ embeds: [embed] });
		awaitingIdFrom.set(targetUserId, targetData); // Remettre en attente
		return;
	}

	// Créer la liaison
	whitelist[targetUserId] = {
		tag: targetData.tag,
		robloxId: robloxId,
		hasRole: true,
		linkedAt: new Date().toISOString(),
		linkedBy: message.author.tag
	};

	saveWhitelist(whitelist);

	// Confirmation
	const embed = new EmbedBuilder()
		.setTitle('✅ Joueur lié avec succès')
		.setDescription(`${targetData.tag} a été lié à l'ID Roblox`)
		.setColor(0x00FF00)
		.addFields([
			{ name: '👤 Discord', value: targetData.tag, inline: true },
			{ name: '🎮 Roblox ID', value: robloxId, inline: true },
			{ name: '👮 Par', value: message.author.tag, inline: true }
		])
		.setTimestamp();

	logsChannel.send({ embeds: [embed] });

	// Réaction de confirmation sur le message
	message.react('✅').catch(() => {});

	console.log(`✅ ${targetData.tag} lié à ${robloxId} par ${message.author.tag}`);
});

// ═══════════════════════════════════════════════════════════════
// 🌐 API EXPRESS
// ═══════════════════════════════════════════════════════════════

const app = express();
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// 🔑 MIDDLEWARE: Vérifier API Key
// ═══════════════════════════════════════════════════════════════

function verifyApiKey(req, res, next) {
	const apiKey = req.headers['x-api-key'];
	if (!apiKey || apiKey !== CONFIG.API_KEY) {
		return res.status(401).json({ error: 'Unauthorized' });
	}
	next();
}

// ═══════════════════════════════════════════════════════════════
// 🏥 ENDPOINT: Health check
// ═══════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
	res.json({
		status: 'online',
		bot: client.user?.tag || 'connecting',
		uptime: process.uptime()
	});
});

// ═══════════════════════════════════════════════════════════════
// ✅ ENDPOINT: Vérifier whitelist
// ═══════════════════════════════════════════════════════════════

app.get('/check/:robloxId', verifyApiKey, async (req, res) => {
	const { robloxId } = req.params;
	const whitelist = loadWhitelist();

	// Chercher le Discord ID qui correspond à ce Roblox ID
	const entry = Object.entries(whitelist).find(
		([discordId, data]) => data.robloxId === robloxId
	);

	if (!entry) {
		// Pas lié
		return res.json({
			whitelisted: false,
			linked: false,
			hasRole: false
		});
	}

	const [discordId, data] = entry;

	// Vérifier le rôle en temps réel
	let hasRoleNow = false;
	if (guild && whitelistRole) {
		try {
			const member = await guild.members.fetch(discordId);
			hasRoleNow = member.roles.cache.has(whitelistRole.id);

			// Mettre à jour si changement
			if (hasRoleNow !== data.hasRole) {
				data.hasRole = hasRoleNow;
				whitelist[discordId] = data;
				saveWhitelist(whitelist);
			}
		} catch (error) {
			console.error('Erreur fetch member:', error);
		}
	}

	res.json({
		whitelisted: hasRoleNow,
		linked: true,
		hasRole: hasRoleNow,
		discordTag: data.tag
	});
});

// ═══════════════════════════════════════════════════════════════
// 🚀 DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

app.listen(CONFIG.PORT, () => {
	console.log(`✅ API démarrée sur port ${CONFIG.PORT}`);
});

client.login(CONFIG.BOT_TOKEN);

// ═══════════════════════════════════════════════════════════════
// 🛑 GESTION ERREURS
// ═══════════════════════════════════════════════════════════════

process.on('unhandledRejection', error => {
	console.error('❌ Erreur:', error);
});

process.on('SIGTERM', () => {
	console.log('🛑 Arrêt du bot...');
	client.destroy();
	process.exit(0);
});

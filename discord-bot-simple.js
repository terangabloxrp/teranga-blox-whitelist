// ═══════════════════════════════════════════════════════════════
// 🤖 TERANGA BLOX RP - BOT DISCORD FINAL AVEC LOGS DÉTAILLÉS
// ═══════════════════════════════════════════════════════════════

const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
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
// 📂 STOCKAGE
// ═══════════════════════════════════════════════════════════════

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
	fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData(filename) {
	const filepath = path.join(DATA_DIR, filename);
	if (!fs.existsSync(filepath)) {
		return {};
	}
	try {
		return JSON.parse(fs.readFileSync(filepath, 'utf8'));
	} catch (error) {
		console.error(`❌ Erreur lecture ${filename}:`, error);
		return {};
	}
}

function saveData(filename, data) {
	const filepath = path.join(DATA_DIR, filename);
	try {
		fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
	} catch (error) {
		console.error(`❌ Erreur sauvegarde ${filename}:`, error);
	}
}

// ═══════════════════════════════════════════════════════════════
// 📊 STATISTIQUES
// ═══════════════════════════════════════════════════════════════

function getStats() {
	const verified = loadData('verified.json');
	const pending = loadData('pending_codes.json');
	
	let withRole = 0;
	let withoutRole = 0;
	
	for (const data of Object.values(verified)) {
		if (data.hasRole) {
			withRole++;
		} else {
			withoutRole++;
		}
	}
	
	return {
		totalVerified: Object.keys(verified).length,
		withRole: withRole,
		withoutRole: withoutRole,
		pendingCodes: Object.keys(pending).length
	};
}

function logStats() {
	const stats = getStats();
	console.log('═══════════════════════════════════════');
	console.log('📊 STATISTIQUES');
	console.log(`   Total vérifié: ${stats.totalVerified}`);
	console.log(`   Avec rôle: ${stats.withRole}`);
	console.log(`   Sans rôle: ${stats.withoutRole}`);
	console.log(`   Codes en attente: ${stats.pendingCodes}`);
	console.log('═══════════════════════════════════════');
}

// ═══════════════════════════════════════════════════════════════
// 🤖 CLIENT DISCORD
// ═══════════════════════════════════════════════════════════════

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers
	]
});

let guild = null;
let whitelistRole = null;
let logsChannel = null;

// ═══════════════════════════════════════════════════════════════
// 📊 LOGS DISCORD
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

	logsChannel.send({ embeds: [embed] }).catch(err => {
		console.error('❌ Erreur log:', err.message);
	});
}

// ═══════════════════════════════════════════════════════════════
// ✅ BOT PRÊT
// ═══════════════════════════════════════════════════════════════

client.once('ready', async () => {
	console.log('═══════════════════════════════════════');
	console.log(`✅ Bot connecté : ${client.user.tag}`);
	console.log('═══════════════════════════════════════');

	guild = client.guilds.cache.get(CONFIG.GUILD_ID);
	if (!guild) {
		console.error('❌ Guild introuvable !');
		return;
	}
	console.log(`✅ Serveur : ${guild.name}`);

	whitelistRole = guild.roles.cache.find(role => role.name === CONFIG.ROLE_NAME);
	if (!whitelistRole) {
		console.error(`❌ Rôle "${CONFIG.ROLE_NAME}" introuvable !`);
	} else {
		console.log(`✅ Rôle trouvé : @${whitelistRole.name} (${whitelistRole.id})`);
	}

	logsChannel = guild.channels.cache.find(ch => ch.name === CONFIG.LOG_CHANNEL);
	if (!logsChannel) {
		console.warn(`⚠️ Salon "${CONFIG.LOG_CHANNEL}" introuvable`);
	} else {
		console.log(`✅ Logs : #${logsChannel.name}`);
	}

	// Enregistrer commandes
	const commands = [
		{
			name: 'verify',
			description: 'Vérifier un code de validation Roblox',
			options: [
				{
					name: 'code',
					description: 'Le code à 6 caractères (ex: AB3K9F)',
					type: 3,
					required: true
				}
			]
		}
	];

	const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);

	try {
		await rest.put(
			Routes.applicationGuildCommands(client.user.id, CONFIG.GUILD_ID),
			{ body: commands }
		);
		console.log('✅ Commande /verify enregistrée');
	} catch (error) {
		console.error('❌ Erreur commandes:', error);
	}

	// Afficher stats
	logStats();
	
	// Stats toutes les 5 minutes
	setInterval(() => {
		logStats();
	}, 300000);
});

// ═══════════════════════════════════════════════════════════════
// 🎫 COMMANDE: /verify
// ═══════════════════════════════════════════════════════════════

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	if (interaction.commandName === 'verify') {
		const code = interaction.options.getString('code').toUpperCase().trim();
		const member = interaction.member;

		console.log('═══════════════════════════════════════');
		console.log(`📨 [VERIFY] ${member.user.tag} essaie code: ${code}`);

		// Vérifier rôle
		if (!member.roles.cache.has(whitelistRole.id)) {
			console.log(`❌ [VERIFY] ${member.user.tag} n'a pas le rôle ${CONFIG.ROLE_NAME}`);
			
			const embed = new EmbedBuilder()
				.setTitle('❌ Accès refusé')
				.setDescription(`Vous devez avoir le rôle @${CONFIG.ROLE_NAME} pour vérifier un code.`)
				.setColor(0xFF0000);

			return interaction.reply({
				embeds: [embed],
				ephemeral: true
			});
		}

		// Vérifier format
		if (!/^[A-Z0-9]{6}$/.test(code)) {
			console.log(`❌ [VERIFY] Format invalide: ${code}`);
			
			const embed = new EmbedBuilder()
				.setTitle('❌ Code invalide')
				.setDescription('Le code doit contenir 6 caractères (lettres et chiffres).')
				.setColor(0xFF0000);

			return interaction.reply({
				embeds: [embed],
				ephemeral: true
			});
		}

		// Chercher le code
		const pendingCodes = loadData('pending_codes.json');
		const codeData = pendingCodes[code];

		if (!codeData) {
			console.log(`❌ [VERIFY] Code ${code} introuvable`);
			
			const embed = new EmbedBuilder()
				.setTitle('❌ Code introuvable')
				.setDescription(`Le code \`${code}\` n'existe pas ou a déjà été utilisé.`)
				.setColor(0xFF0000);

			return interaction.reply({
				embeds: [embed],
				ephemeral: true
			});
		}

		console.log(`✅ [VERIFY] Code trouvé pour ${codeData.robloxName}`);

		// Vérifier si déjà vérifié
		const verified = loadData('verified.json');
		if (verified[codeData.robloxId]) {
			console.log(`⚠️ [VERIFY] ${codeData.robloxName} déjà vérifié`);
			
			const embed = new EmbedBuilder()
				.setTitle('⚠️ Déjà vérifié')
				.setDescription(`Ce joueur est déjà vérifié.`)
				.setColor(0xFFAA00)
				.addFields([
					{ name: '🎮 Roblox', value: `${codeData.robloxName} (${codeData.robloxId})`, inline: true },
					{ name: '👤 Discord', value: verified[codeData.robloxId].discordTag, inline: true }
				]);

			return interaction.reply({
				embeds: [embed],
				ephemeral: true
			});
		}

		// Valider le code
		verified[codeData.robloxId] = {
			discordId: member.id,
			discordTag: member.user.tag,
			hasRole: true,
			verifiedAt: new Date().toISOString(),
			code: code
		};

		saveData('verified.json', verified);

		// Supprimer le code
		delete pendingCodes[code];
		saveData('pending_codes.json', pendingCodes);

		console.log(`✅ [VERIFY] ${codeData.robloxName} vérifié par ${member.user.tag}`);
		logStats();

		// Réponse succès
		const embed = new EmbedBuilder()
			.setTitle('✅ Joueur vérifié !')
			.setDescription('Le compte a été lié avec succès.')
			.setColor(0x00FF00)
			.addFields([
				{ name: '🎮 Roblox', value: `${codeData.robloxName} (${codeData.robloxId})`, inline: true },
				{ name: '👤 Discord', value: member.user.tag, inline: true },
				{ name: '🎫 Code', value: code, inline: true }
			]);

		await interaction.reply({ embeds: [embed] });

		// Log
		sendLog(
			'✅ Vérification réussie',
			'Un joueur a été vérifié',
			0x00FF00,
			[
				{ name: '🎮 Roblox', value: `${codeData.robloxName} (${codeData.robloxId})`, inline: true },
				{ name: '👤 Discord', value: member.user.tag, inline: true },
				{ name: '🎫 Code', value: code, inline: true }
			]
		);
		
		console.log('═══════════════════════════════════════');
	}
});

// ═══════════════════════════════════════════════════════════════
// 👤 ÉVÉNEMENT: Rôle modifié
// ═══════════════════════════════════════════════════════════════

client.on('guildMemberUpdate', async (oldMember, newMember) => {
	if (!whitelistRole) return;

	const hadRole = oldMember.roles.cache.has(whitelistRole.id);
	const hasRoleNow = newMember.roles.cache.has(whitelistRole.id);

	// Rôle retiré
	if (hadRole && !hasRoleNow) {
		console.log('═══════════════════════════════════════');
		console.log(`❌ [ROLE] Rôle retiré de ${newMember.user.tag}`);
		
		const verified = loadData('verified.json');
		let updated = 0;

		// Trouver comptes liés
		for (const [robloxId, data] of Object.entries(verified)) {
			if (data.discordId === newMember.id) {
				data.hasRole = false;
				updated++;
				console.log(`   → Roblox ID ${robloxId} marqué sans rôle`);
			}
		}

		if (updated > 0) {
			saveData('verified.json', verified);
			logStats();
		}

		sendLog(
			'❌ Rôle retiré',
			`${newMember.user.tag} n'a plus le rôle @${CONFIG.ROLE_NAME}`,
			0xFF0000,
			[
				{ name: 'Discord', value: newMember.user.tag, inline: true },
				{ name: 'Comptes affectés', value: updated.toString(), inline: true },
				{ name: 'Statut', value: '❌ Accès révoqué', inline: true }
			]
		);
		
		console.log('═══════════════════════════════════════');
	}

	// Rôle redonné
	if (!hadRole && hasRoleNow) {
		console.log('═══════════════════════════════════════');
		console.log(`✅ [ROLE] Rôle redonné à ${newMember.user.tag}`);
		
		const verified = loadData('verified.json');
		let updated = 0;

		// Trouver comptes liés
		for (const [robloxId, data] of Object.entries(verified)) {
			if (data.discordId === newMember.id) {
				data.hasRole = true;
				updated++;
				console.log(`   → Roblox ID ${robloxId} marqué avec rôle`);
			}
		}

		if (updated > 0) {
			saveData('verified.json', verified);
			logStats();
		}

		sendLog(
			'✅ Rôle redonné',
			`${newMember.user.tag} a retrouvé le rôle @${CONFIG.ROLE_NAME}`,
			0x00FF00,
			[
				{ name: 'Discord', value: newMember.user.tag, inline: true },
				{ name: 'Comptes affectés', value: updated.toString(), inline: true },
				{ name: 'Statut', value: '✅ Accès rétabli', inline: true }
			]
		);
		
		console.log('═══════════════════════════════════════');
	}
});

// ═══════════════════════════════════════════════════════════════
// 🌐 API EXPRESS
// ═══════════════════════════════════════════════════════════════

const app = express();
app.use(express.json());

// Middleware API Key
function verifyApiKey(req, res, next) {
	const apiKey = req.headers['x-api-key'];
	if (!apiKey || apiKey !== CONFIG.API_KEY) {
		console.log(`❌ [API] Requête non autorisée de ${req.ip}`);
		return res.status(401).json({ error: 'Unauthorized' });
	}
	next();
}

// Health
app.get('/health', (req, res) => {
	const stats = getStats();
	res.json({
		status: 'online',
		bot: client.user?.tag || 'connecting',
		uptime: process.uptime(),
		stats: stats
	});
});

// Créer code
app.post('/createcode', verifyApiKey, (req, res) => {
	const { robloxId, robloxName } = req.body;

	if (!robloxId || !robloxName) {
		return res.status(400).json({ error: 'Missing parameters' });
	}

	const pendingCodes = loadData('pending_codes.json');
	const existingCode = Object.entries(pendingCodes).find(
		([code, data]) => data.robloxId === robloxId
	);

	if (existingCode) {
		console.log(`🔄 [API] Code existant réutilisé: ${existingCode[0]} pour ${robloxName}`);
		return res.json({
			success: true,
			code: existingCode[0],
			existing: true
		});
	}

	// Générer nouveau code
	const code = generateCode();
	pendingCodes[code] = {
		robloxId: robloxId,
		robloxName: robloxName,
		createdAt: new Date().toISOString()
	};

	saveData('pending_codes.json', pendingCodes);

	console.log(`🎫 [API] Code créé: ${code} pour ${robloxName} (${robloxId})`);
	logStats();

	res.json({
		success: true,
		code: code,
		existing: false
	});
});

function generateCode() {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

// Vérifier statut
app.get('/check/:robloxId', verifyApiKey, async (req, res) => {
	const { robloxId } = req.params;

	const verified = loadData('verified.json');
	const data = verified[robloxId];

	if (!data) {
		console.log(`🔍 [API] Check ${robloxId}: Non vérifié`);
		return res.json({
			verified: false,
			hasRole: false
		});
	}

	// Vérifier rôle en temps réel
	let hasRoleNow = false;
	if (guild && whitelistRole) {
		try {
			const member = await guild.members.fetch(data.discordId);
			hasRoleNow = member.roles.cache.has(whitelistRole.id);

			// Mettre à jour si changement
			if (hasRoleNow !== data.hasRole) {
				console.log(`🔄 [API] Mise à jour rôle pour ${robloxId}: ${data.hasRole} → ${hasRoleNow}`);
				data.hasRole = hasRoleNow;
				verified[robloxId] = data;
				saveData('verified.json', verified);
			}
		} catch (error) {
			console.error(`❌ [API] Erreur fetch member ${data.discordId}:`, error.message);
		}
	}

	console.log(`🔍 [API] Check ${robloxId}: Vérifié=${true}, Rôle=${hasRoleNow}`);

	res.json({
		verified: true,
		hasRole: hasRoleNow,
		discordTag: data.discordTag
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
	console.error('❌ Erreur:', error.message);
});

process.on('SIGTERM', () => {
	console.log('🛑 Arrêt du bot...');
	logStats();
	client.destroy();
	process.exit(0);
});

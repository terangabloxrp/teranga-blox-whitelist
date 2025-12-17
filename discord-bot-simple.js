// ═══════════════════════════════════════════════════════════════
// 🤖 TERANGA BLOX RP - BOT DISCORD AVEC CODES AUTOMATIQUES
// ═══════════════════════════════════════════════════════════════
// Système de vérification par codes uniques
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

	// Enregistrer commandes
	const commands = [
		{
			name: 'verify',
			description: 'Vérifier un code de validation Roblox',
			options: [
				{
					name: 'code',
					description: 'Le code à 6 caractères (ex: AB3K9F)',
					type: 3, // STRING
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

	const verified = loadData('verified.json');
	console.log(`📊 ${Object.keys(verified).length} joueur(s) vérifié(s)`);
});

// ═══════════════════════════════════════════════════════════════
// 🎫 COMMANDE: /verify
// ═══════════════════════════════════════════════════════════════

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	if (interaction.commandName === 'verify') {
		const code = interaction.options.getString('code').toUpperCase().trim();
		const member = interaction.member;

		// Vérifier rôle
		if (!member.roles.cache.has(whitelistRole.id)) {
			const embed = new EmbedBuilder()
				.setTitle('❌ Accès refusé')
				.setDescription(`Vous devez avoir le rôle @${CONFIG.ROLE_NAME} pour vérifier un code.`)
				.setColor(0xFF0000);

			return interaction.reply({
				embeds: [embed],
				ephemeral: true
			});
		}

		// Vérifier format code (6 caractères alphanumériques)
		if (!/^[A-Z0-9]{6}$/.test(code)) {
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
			const embed = new EmbedBuilder()
				.setTitle('❌ Code introuvable')
				.setDescription(`Le code \`${code}\` n'existe pas ou a déjà été utilisé.`)
				.setColor(0xFF0000);

			return interaction.reply({
				embeds: [embed],
				ephemeral: true
			});
		}

		// Vérifier si déjà vérifié
		const verified = loadData('verified.json');
		if (verified[codeData.robloxId]) {
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

		await interaction.reply({
			embeds: [embed]
		});

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

		console.log(`✅ ${member.user.tag} a vérifié ${codeData.robloxName} (${code})`);
	}
});

// ═══════════════════════════════════════════════════════════════
// 👤 ÉVÉNEMENT: Rôle retiré
// ═══════════════════════════════════════════════════════════════

client.on('guildMemberUpdate', async (oldMember, newMember) => {
	if (!whitelistRole) return;

	const hadRole = oldMember.roles.cache.has(whitelistRole.id);
	const hasRoleNow = newMember.roles.cache.has(whitelistRole.id);

	// Rôle retiré
	if (hadRole && !hasRoleNow) {
		const verified = loadData('verified.json');

		// Trouver tous les comptes liés à ce Discord ID
		for (const [robloxId, data] of Object.entries(verified)) {
			if (data.discordId === newMember.id) {
				data.hasRole = false;
				console.log(`❌ Rôle retiré pour ${data.discordTag} (Roblox: ${robloxId})`);
			}
		}

		saveData('verified.json', verified);

		sendLog(
			'❌ Rôle retiré',
			`${newMember.user.tag} n'a plus le rôle`,
			0xFF0000,
			[
				{ name: 'Discord', value: newMember.user.tag, inline: true },
				{ name: 'Statut', value: '❌ Accès révoqué', inline: true }
			]
		);
	}

	// Rôle redonné
	if (!hadRole && hasRoleNow) {
		const verified = loadData('verified.json');

		// Trouver tous les comptes liés à ce Discord ID
		for (const [robloxId, data] of Object.entries(verified)) {
			if (data.discordId === newMember.id) {
				data.hasRole = true;
				console.log(`✅ Rôle redonné pour ${data.discordTag} (Roblox: ${robloxId})`);
			}
		}

		saveData('verified.json', verified);

		sendLog(
			'✅ Rôle redonné',
			`${newMember.user.tag} a retrouvé le rôle`,
			0x00FF00,
			[
				{ name: 'Discord', value: newMember.user.tag, inline: true },
				{ name: 'Statut', value: '✅ Accès rétabli', inline: true }
			]
		);
	}
});

// ═══════════════════════════════════════════════════════════════
// 🌐 API EXPRESS
// ═══════════════════════════════════════════════════════════════

const app = express();
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// 🔑 MIDDLEWARE: API Key
// ═══════════════════════════════════════════════════════════════

function verifyApiKey(req, res, next) {
	const apiKey = req.headers['x-api-key'];
	if (!apiKey || apiKey !== CONFIG.API_KEY) {
		return res.status(401).json({ error: 'Unauthorized' });
	}
	next();
}

// ═══════════════════════════════════════════════════════════════
// 🏥 ENDPOINT: Health
// ═══════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
	res.json({
		status: 'online',
		bot: client.user?.tag || 'connecting',
		uptime: process.uptime()
	});
});

// ═══════════════════════════════════════════════════════════════
// 🎫 ENDPOINT: Créer code
// ═══════════════════════════════════════════════════════════════

app.post('/createcode', verifyApiKey, (req, res) => {
	const { robloxId, robloxName } = req.body;

	if (!robloxId || !robloxName) {
		return res.status(400).json({ error: 'Missing parameters' });
	}

	// Vérifier si déjà un code actif
	const pendingCodes = loadData('pending_codes.json');
	const existingCode = Object.entries(pendingCodes).find(
		([code, data]) => data.robloxId === robloxId
	);

	if (existingCode) {
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

	console.log(`🎫 Code créé: ${code} pour ${robloxName} (${robloxId})`);

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

// ═══════════════════════════════════════════════════════════════
// ✅ ENDPOINT: Vérifier statut
// ═══════════════════════════════════════════════════════════════

app.get('/check/:robloxId', verifyApiKey, async (req, res) => {
	const { robloxId } = req.params;

	const verified = loadData('verified.json');
	const data = verified[robloxId];

	if (!data) {
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
				data.hasRole = hasRoleNow;
				verified[robloxId] = data;
				saveData('verified.json', verified);
			}
		} catch (error) {
			console.error('Erreur fetch member:', error.message);
		}
	}

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
	client.destroy();
	process.exit(0);
});
```

---

# 📋 COMMENT REMPLACER SUR GITHUB

1. **Va sur GitHub** → Ton repository `teranga-blox-whitelist-v2`

2. **Clique sur `discord-bot-codes.js`**

3. **Clique sur l'icône crayon** (Edit)

4. **Ctrl+A** (tout sélectionner)

5. **Delete**

6. **Copie TOUT le code ci-dessus**

7. **Colle dans GitHub**

8. **Scroll en bas** → **Commit changes**

9. **Va sur Render** → Ton service

10. **Manual Deploy** → **Deploy latest commit**

11. **Attends 2-3 minutes**

12. **Vérifie les logs Render**

---

## ✅ TU DOIS VOIR DANS LES LOGS RENDER
```
✅ API démarrée sur port 10000
✅ Bot connecté : Teranga Blox Whitelist#1234
✅ Rôle trouvé : @CITOYEN
✅ Logs : #whitelist-logs
✅ Commande /verify enregistrée
📊 0 joueur(s) vérifié(s)
==> Your service is live 🎉

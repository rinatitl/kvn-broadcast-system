const { createApp } = Vue;

const teamsRep = nodecg.Replicant("teams", "kvn-file-upload");
const contestsRep = nodecg.Replicant("contests", "kvn-file-upload");
const scoreboardStatusRep = nodecg.Replicant("scoreboard-status", "kvn-scoreboard");
const playbackRep = nodecg.Replicant("score-playback", "kvn-scoreboard");
const activeSceneRep = nodecg.Replicant("active-scene", "kvn-file-upload");

createApp({
	data() {
		return {
			vueTeams: [],
			addingPoints: {},
			rawImportString: "",
			adminSort: false,
			showConfirmModal: false,
			showSimulationModal: false,
			confirmListData: [],
			scoreboardStatus: {},
			activeScene: "",
			showConflicts: false,
			dropCount: 5,
			playbackBusy: false,
			sendingPoints: false,
		};
	},
	methods: {
		async applyPoints(teamId, mode = "normal") {
			if (this.playbackBusy || this.sendingPoints) return;
			const points = parseInt(this.addingPoints[teamId]) || 0;
			if (!points) return;
			this.sendingPoints = true;
			try {
				await nodecg.sendMessage("apply-score", { teamId, points, mode });
				this.addingPoints[teamId] = "";
			} catch (error) {
				console.error("Не удалось начислить баллы", error);
			} finally {
				this.sendingPoints = false;
			}
		},
		playNext(mode) {
			if (this.nextTeam) this.applyPoints(this.nextTeam.id, mode);
		},
		updateNextTooltip() {
			const element = this.$refs.nextTooltip;
			if (element) bootstrap.Tooltip.getOrCreateInstance(element).setContent({
				".tooltip-inner": this.nextTeamTitle,
			});
		},
		parseGoogleScores() {
			// 1. Проверяем наличие строки
			if (!this.rawImportString.trim()) {
				alert("Строка пуста");
				return;
			}

			// 2. Достаем исходный массив из репликанта (НЕ из computed displayTeams)
			// Предполагаем, что vueTeams — это данные твоего репликанта teams
			const originalTeams = this.vueTeams;

			if (originalTeams.length === 0) {
				alert("Команд 0");
				return;
			}

			// Извлекаем только числа из строки
			const importedValues = _.trim(_.replace(this.rawImportString, /\D+/g, " ")).split(/\s+/);

			if (importedValues.length < originalTeams.length) {
				if (
					!confirm(
						`В строке только ${importedValues.length} значений, а команд ${originalTeams.length}. Продолжить?`,
					)
				)
					return;
			}
			// 3. Формируем список подтверждения, опираясь на ИСХОДНЫЙ порядок
			this.confirmListData = originalTeams.map((team, index) => {
				const addedVal = parseInt(importedValues[index]) || 0;
				return {
					id: team.id,
					name: team.name,
					added: addedVal,
					newTotal: (Number(team.sum) || 0) + addedVal,
				};
			});

			this.showConfirmModal = true;
		},
		confirmAndDistribute() {
			this.confirmListData.forEach((item) => {
				this.addingPoints[item.id] = item.added;
			});
			this.showConfirmModal = false;
			this.rawImportString = "";
		},
		toggleAir(status) {
			scoreboardStatusRep.value.isOnAir = status;
		},
		clearScreen() {
			scoreboardStatusRep.value.isOnAir = false;
			nodecg.sendMessage("clear-screen-instant");
			console.log("sent clearscreen");
		},
		takeToAir() {
			activeSceneRep.value = "scoreboard";
			scoreboardStatusRep.value.isOnAir = false;
			nodecg.sendMessage("clear-screen-instant");
		},
		updateTeams() {
			teamsRep.value = JSON.parse(JSON.stringify(this.vueTeams));
		},
		clearVotes() {
			if (confirm("Удалить все 0 в полях для голосов?")) {
				const teams = JSON.parse(JSON.stringify(this.vueTeams));
				teams.forEach((team) => {
					team.votes = "";
				});
				this.vueTeams = teams;
			}
		},
		clearSums() {
			if (confirm("Обнулить все итоговые баллы?")) {
				const teams = JSON.parse(JSON.stringify(this.vueTeams));
				teams.forEach((team) => {
					team.sum = 0;
				});
				teamsRep.value = teams;
			}
		},
		clearAddingPoints() {
			if (confirm("Очистить все добавляемые баллы?")) {
				this.addingPoints = {};
			}
		},
		moveFocus(currentIndex, direction, fieldType) {
			const nextIndex = currentIndex + direction;

			if (nextIndex >= 0 && nextIndex < this.vueTeams.length) {
				const nextRefName = `input-${fieldType}-${nextIndex}`;
				const nextInput = this.$refs[nextRefName];

				if (nextInput && nextInput[0]) {
					nextInput[0].focus();
					nextInput[0].select();
				}
			}
		},
		resetHighlights() {
			nodecg.sendMessage("trigger-reset-highlights");
		},
		confirmElimination() {
			if (!teamsRep.value) {
				console.error("Репликант команд еще не загрузился!");
				return;
			}
			if (!this.dropCount || this.dropCount <= 0) return;

			const teams = JSON.parse(JSON.stringify(teamsRep.value));

			const sortedTeams = [...teams].sort((a, b) => {
				return b.sum - a.sum || b.votes - a.votes;
			});

			const idsToDrop = sortedTeams.slice(-this.dropCount).map((t) => t.id);

			teams.forEach((team) => {
				team.isInactive = idsToDrop.includes(team.id);
			});

			teamsRep.value = teams;

			setTimeout(() => {
				nodecg.sendMessage("trigger-elimination-animation", idsToDrop);
			}, 50);
		},
		cancelElimination() {
			const teams = JSON.parse(JSON.stringify(teamsRep.value));

			teams.forEach((team) => {
				team.isInactive = false;
			});

			teamsRep.value = teams;
			nodecg.sendMessage("cancel-elimination-animation");
		},
	},
	computed: {
		nextTeam() {
			const ranked = _.orderBy(this.vueTeams, [t => Number(t.sum) || 0, t => Number(t.votes) || 0], ["desc", "desc"]);
			return ranked.reverse().find(t => !t.isInactive && (parseInt(this.addingPoints[t.id]) || 0) !== 0);
		},
		nextTeamTitle() {
			return this.nextTeam ? this.nextTeam.name : "Нет команд для начисления";
		},
		displayTeams() {
			if (!this.vueTeams || this.vueTeams.length === 0) {
				return [];
			}

			if (this.adminSort) {
				return _.orderBy(this.vueTeams, ["sum", "votes"], ["desc", "desc"]);
			}
			return this.vueTeams;
		},
		simulationResults() {
			if (!this.vueTeams || this.vueTeams.length === 0) return [];

			let draft = this.vueTeams.map((team) => ({
				...team,
				sum: (Number(team.sum) || 0) + (parseInt(this.addingPoints[team.id]) || 0),
				votes: team.votes,
			}));
			return _.orderBy(draft, ["sum", "votes"], ["desc", "desc"]);
		},
		tallyStatus() {
			const isTitleReady = this.scoreboardStatus.isOnAir;
			const isThisBundleOnMaster = this.activeScene === "scoreboard";

			if (isTitleReady && isThisBundleOnMaster) {
				return "on-air"; // Красный: и там, и там
			} else if (isThisBundleOnMaster) {
				return "ready"; // Зеленый: готов в бандле, но Мастер занят другим
			} else {
				return "offline"; // Серый: в бандле пусто
			}
		},
		calculatedScores() {
			return this.displayTeams.map((team) => {
				const added = parseInt(this.addingPoints[team.id]) || 0;
				const current = parseInt(team.sum) || 0;
				return {
					id: team.id,
					total: current + added,
					votes: parseInt(team.votes) || 0,
				};
			});
		},
		conflictingTeamIds() {
			if (!this.showConflicts) return [];
			const scores = this.calculatedScores;

			return scores
				.filter((item) => {
					// Игнорируем стартовый ноль
					if (item.total === 0) return false;
					// Ищем любого соперника с таким же итогом
					return scores.some((other) => other.id !== item.id && other.total === item.total);
				})
				.map((item) => item.id);
		},
		teamsNeedingVotes() {
			if (!this.showConflicts) return [];
			const scores = this.calculatedScores;

			return scores
				.filter((item) => {
					if (item.total === 0) return false;

					// Есть ли кто-то с таким же баллом?
					const hasRivals = scores.some(
						(other) => other.id !== item.id && other.total === item.total,
					);

					// Равенство есть, а конкретно этой команде голос не дали
					return hasRivals && item.votes === 0;
				})
				.map((item) => item.id);
		},
	},
	watch: {
		nextTeamTitle() { this.$nextTick(this.updateNextTooltip); },
	},
	mounted() {
		playbackRep.on("change", value => { this.playbackBusy = !!value?.busy; });
		this.$nextTick(this.updateNextTooltip);
		NodeCG.waitForReplicants(teamsRep, contestsRep, scoreboardStatusRep, activeSceneRep).then(
			() => {
				teamsRep.on("change", (newVal) => {
					if (newVal) this.vueTeams = JSON.parse(JSON.stringify(newVal)) || [];

					newVal.forEach((team) => {
						if (this.addingPoints[team.id] === undefined) {
							this.addingPoints[team.id] = "";
						}
					});
				});

				contestsRep.on("change", (newVal) => {
					if (newVal) this.vueContests = JSON.parse(JSON.stringify(newVal)) || [];
				});

				scoreboardStatusRep.on("change", (newVal) => {
					if (newVal) this.scoreboardStatus = JSON.parse(JSON.stringify(newVal)) || [];
				});

				activeSceneRep.on("change", (newVal) => {
					if (newVal) this.activeScene = JSON.parse(JSON.stringify(newVal));
				});
			},
		);
	},
}).mount("#app");

document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
	new bootstrap.Tooltip(element);
});

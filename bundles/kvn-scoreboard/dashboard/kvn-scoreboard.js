const { createApp } = Vue;

const teamsRep = nodecg.Replicant("teams", "kvn-file-upload");
const contestsRep = nodecg.Replicant("contests", "kvn-file-upload");
const generalRep = nodecg.Replicant("general-information", "kvn-file-upload");
const scoreboardStatusRep = nodecg.Replicant("scoreboard-status", "kvn-scoreboard");
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
		};
	},
	methods: {
		applyPoints(teamId) {
			const team = teamsRep.value.find((t) => t.id === teamId);
            const p = parseInt(this.addingPoints[teamId]) || 0;

            if (team && p !== 0) {
                team.sum += p;
                
                // Очищаем только поле добавления
                this.addingPoints[teamId] = "";

                // Сигнал графике "моргнуть" цифрой
				nodecg.sendMessage("highlight-score", teamId);
            }
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
					newTotal: (team.sum || 0) + addedVal,
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
		resetAllScores() {
            if (confirm("Внимание! Это обнулит ВСЕ баллы и голоса. Уверены?")) {
				teamsRep.value.forEach((t) => {
                    t.sum = 0;
                    t.votes = 0;
                });
            }
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
	},
	computed: {
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
                sum: team.sum + (parseInt(this.addingPoints[team.id]) || 0),
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
		}	
	},
	mounted() {
		NodeCG.waitForReplicants(teamsRep, contestsRep, scoreboardStatusRep, activeSceneRep).then(() => {
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
        });
	},
}).mount("#app");

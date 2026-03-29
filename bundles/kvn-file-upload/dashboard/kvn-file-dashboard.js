const { createApp } = Vue;

const teamsRep = nodecg.Replicant('teams', 'kvn-file-upload');
const juriesRep = nodecg.Replicant('juries', 'kvn-file-upload');
const contestsRep = nodecg.Replicant('contests', 'kvn-file-upload');
const generalRep = nodecg.Replicant('general-information', 'kvn-file-upload');

createApp({
	data() {
		return {
			isLoaded: false,
			importText: '',
			vueTeams: [],
			vueJuries: [],
			vueContests: [],
			vueGeneral: {},
		}
	},
	methods: {
		importFromInput() {
			try {
                // Превращаем текст из инпута в объект JS
                const data = JSON.parse(this.importText);
                // Раскладываем по репликантам (базе SQLite)
                if (data.general) generalRep.value = data.general;
				if (data.juries) juriesRep.value = data.juries;
                if (data.teams) teamsRep.value = data.teams;
                if (data.contests) contestsRep.value = data.contests;

                this.importText = ''; // Очищаем поле после импорта
            } catch (err) {
                alert('Ошибка! Текст не является валидным JSON. Проверь скобки и кавычки.');
                console.error(err);
            }
        },
		exportToInput() {
			const fullData = {
				general: this.vueGeneral,
				contests: this.vueContests, 
				juries: this.vueJuries,
				teams: this.vueTeams
			};
			this.importText = JSON.stringify(fullData);
		},
		clearDatabase() {
			const firstConfirm = confirm("Вы уверены, что хотите ПОЛНОСТЬЮ очистить базу данных?");
			if (!firstConfirm) return;

			this.vueTeams = [];
			this.vueJuries = [];
			this.vueContests = [];
			this.vueGeneral = {};

			this.sync(teamsRep, this.vueTeams);
			this.sync(juriesRep, this.vueJuries);
			this.sync(contestsRep, this.vueContests);
			this.sync(generalRep, this.vueGeneral);
		},
		prepareForAir(element) {
			this.vueGeneral.activeTitle.name = element.name;
			this.vueGeneral.activeTitle.description = element.description || "";
			this.updateGeneral();
		},
		sendCustomToAir() {
			this.vueGeneral.activeTitle.name = this.customName;
			this.vueGeneral.activeTitle.description = this.customDescription;
		},
		sync(replicant, data) {
			replicant.value = JSON.parse(JSON.stringify(data));
		},
		updateGeneral() {
			this.sync(generalRep, this.vueGeneral);
		},
		addContest() {
			const currentContests = [...this.vueContests];
			const newId = this.vueContests.length > 0 
				? Math.max(...this.vueContests.map(t => t.id)) + 1 
				: 1;
			currentContests.push({
				id: newId,
				name: "",
				max: 0
			});
			this.vueContests = currentContests;
			this.sync(contestsRep, this.vueContests);
		},
		removeContest(index) {
			if (confirm(`Удалить конкурс "${this.vueContests[index].name || 'Без названия'}"?`)) {
				const currentContests = [...this.vueContests];
				currentContests.splice(index, 1);
				this.vueContests = currentContests;
				this.sync(contestsRep, this.vueContests);
			}
		},
		updateContests() {
			this.sync(contestsRep, this.vueContests);
		},
		addJury() {
			const currentJuries = [...this.vueJuries];
			const newId = this.vueJuries.length > 0 
				? Math.max(...this.vueJuries.map(t => t.id)) + 1 
				: 1;
			currentJuries.push({
				id: newId,
				name: "",
				description: ""
			});
			this.vueJuries = currentJuries;
			this.sync(juriesRep, this.vueJuries);
		},
		removeJury(index) {
			if (confirm(`Удалить жюри "${this.vueJuries[index].name || 'Без имени'}"?`)) {
				const currentJuries = [...this.vueJuries];
				currentJuries.splice(index, 1);
				this.vueJuries = currentJuries;
				this.sync(juriesRep, this.vueJuries);
			}
		},
		updateJuries() {
			this.sync(juriesRep, this.vueJuries);
		},
		addTeam() {
			const currentTeams = [...this.vueTeams];
			const newId = this.vueTeams.length > 0 
				? Math.max(...this.vueTeams.map(t => t.id)) + 1 
				: 1;
			currentTeams.push({
				id: newId,
				name: "",
				description: "",
				sum: 0,
				current: 0,
				votes: 0
			});
			this.vueTeams = currentTeams;
			this.sync(teamsRep, this.vueTeams);
		},
		removeTeam(index) {
			if (confirm(`Удалить команду "${this.vueTeams[index].name || 'Без названия'}"?`)) {
				const currentTeams = [...this.vueTeams];
				currentTeams.splice(index, 1);
				this.vueTeams = currentTeams;
				this.sync(teamsRep, this.vueTeams);
			}
		},
		updateTeams() {
			this.sync(teamsRep, this.vueTeams);
		},
	},
	computed: {
		
	},
	mounted() {
		NodeCG.waitForReplicants(teamsRep, juriesRep, contestsRep, generalRep).then(() => {
			teamsRep.on('change', (val) => {
				if (val) {
					this.vueTeams = JSON.parse(JSON.stringify(val));
				}
			});
            juriesRep.on('change', (val) => {
				if (val) {
					this.vueJuries = JSON.parse(JSON.stringify(val));
				}
			});
            contestsRep.on('change', (val) => {
				if (val) {
					this.vueContests = JSON.parse(JSON.stringify(val));
				}
			});
            generalRep.on('change', (val) => {
				if (val) {
					this.vueGeneral = JSON.parse(JSON.stringify(val));
				}
			});

			this.isLoaded = true;
			console.log('Все репликанты успешно подключены');
        });
	}
}).mount('#app');
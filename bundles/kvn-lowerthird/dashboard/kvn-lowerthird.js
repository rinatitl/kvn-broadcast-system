const generalRep = nodecg.Replicant('general-information', 'kvn-file-upload');
const teamsRep = nodecg.Replicant('teams', 'kvn-file-upload');
const juriesRep = nodecg.Replicant('juries', 'kvn-file-upload');
const activeSceneRep = nodecg.Replicant('active-scene', 'kvn-file-upload');

const { createApp } = Vue;

createApp({
	data() {
		return {
			vueTeams: [],
			vueJuries: [],
			vueGeneral: {
				activeTitle: {
					name: '',
					description: '',
					isOnAir: false,
					autoOut: 0,
					timerVisual: 0
				}
			},
			activeScene: '',
			customSec: 10,
			customName: '',
			customDescription: '',
		}
	},
	methods: {
		updateGeneral() {
			generalRep.value = JSON.parse(JSON.stringify(this.vueGeneral));
		},
		prepareHost() {
			this.vueGeneral.activeTitle.name = this.vueGeneral.host;
			this.vueGeneral.activeTitle.description = "";
			this.updateGeneral();
		},
		prepareTitle(item, type = 'jury') {
			let displayName = item.name;
			if (type === 'team') {
				displayName = `Команда КВН «${item.name}»`;
			}
			this.vueGeneral.activeTitle.name = displayName;
			this.vueGeneral.activeTitle.description = item.description || "";
			this.updateGeneral();
		},
		sendCustom() {
			this.vueGeneral.activeTitle.name = this.customName; 
			this.vueGeneral.activeTitle.description = this.customDescription;
			this.updateGeneral();
		},
		toggleAir(status, seconds = 0) {
			this.vueGeneral.activeTitle.isOnAir = status;
			this.vueGeneral.activeTitle.autoOut = seconds
			this.updateGeneral();
		},
		resetScreen() {
			this.vueGeneral.activeTitle.isOnAir = false;
			this.vueGeneral.activeTitle.timerVisual = 0;
			this.updateGeneral();
			nodecg.sendMessage('force-reset');
		},
		takeToAir() {
			activeSceneRep.value = 'lowerthird';
			generalRep.value.activeTitle.isOnAir = false;
			nodecg.sendMessage('force-reset');
		}
	},
	computed: {
		tallyStatus() {
			const isTitleReady = this.vueGeneral?.activeTitle?.isOnAir || false;
			const isThisBundleOnMaster = this.activeScene === 'lowerthird';

			if (isTitleReady && isThisBundleOnMaster) {
				return 'on-air';    // Красный: и там, и там
			} else if (isThisBundleOnMaster) {
				return 'ready';     // Зеленый: готов в бандле, но Мастер занят другим
			} else {
				return 'offline';   // Серый: в бандле пусто
			}
		}
	},
	mounted() {
		this.autoOutTimer = null;

		NodeCG.waitForReplicants(teamsRep, juriesRep, generalRep, activeSceneRep).then(() => {
            teamsRep.on('change', (newVal) => {
                if (newVal) this.vueTeams = newVal || [];
            });

            juriesRep.on('change', (newVal) => {
                if (newVal) this.vueJuries = newVal || [];
            });

            generalRep.on('change', (newVal) => {
                if (newVal) this.vueGeneral = JSON.parse(JSON.stringify(newVal)) || { activeTitle: {name: '', description: '', isOnAir: false, autoOut: 0, timerVisual: 0}};
            });

			activeSceneRep.on('change', (newVal) => {
                if (newVal) this.activeScene = JSON.parse(JSON.stringify(newVal)) || "";
            });
        });
	}
}).mount('#app');
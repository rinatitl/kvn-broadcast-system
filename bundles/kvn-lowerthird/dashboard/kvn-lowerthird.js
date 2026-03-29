const generalRep = nodecg.Replicant('general-information', 'kvn-file-upload');
const teamsRep = nodecg.Replicant('teams', 'kvn-file-upload');
const juriesRep = nodecg.Replicant('juries', 'kvn-file-upload');
const activeSceneRep = nodecg.Replicant('active-scene', 'kvn-file-upload');
const lowerthirdStatusRep = nodecg.Replicant('lowerthird-status');

const { createApp } = Vue;

createApp({
	data() {
		return {
			vueTeams: [],
			vueJuries: [],
			vueGeneral: {},
			lowerthirdStatus: {},
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
		updateLowerthirdStatus() {
			lowerthirdStatusRep.value = JSON.parse(JSON.stringify(this.lowerthirdStatus));
		},
		prepareHost() {
			this.lowerthirdStatus.name = this.vueGeneral.host;
			this.lowerthirdStatus.description = "";
			this.updateLowerthirdStatus();
		},
		prepareTitle(item, type = 'jury') {
			let displayName = item.name;
			if (type === 'team') {
				displayName = `Команда КВН «${item.name}»`;
			}
			this.lowerthirdStatus.name = displayName;
			this.lowerthirdStatus.description = item.description || "";
			this.updateLowerthirdStatus();
		},
		sendCustom() {
			this.lowerthirdStatus.name = this.customName;
			this.lowerthirdStatus.description = this.customDescription;
			this.updateLowerthirdStatus();
		},
		toggleAir(status, seconds = 0) {
			this.lowerthirdStatus.isOnAir = status;
			this.lowerthirdStatus.autoOut = seconds
			this.updateLowerthirdStatus();
		},
		resetScreen() {
			this.lowerthirdStatus.isOnAir = false;
			this.lowerthirdStatus.timerVisual = 0;
			this.updateLowerthirdStatus();
			nodecg.sendMessage('force-reset');
		},
		takeToAir() {
			this.lowerthirdStatus.isOnAir = false;
			this.lowerthirdStatus.timerVisual = 0;
			this.updateLowerthirdStatus();
			activeSceneRep.value = 'lowerthird';
			nodecg.sendMessage('force-reset');
		}
	},
	computed: {
		tallyStatus() {
			const isTitleReady = this.lowerthirdStatus?.isOnAir || false;
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

		NodeCG.waitForReplicants(teamsRep, juriesRep, generalRep, activeSceneRep, lowerthirdStatusRep).then(() => {
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

			lowerthirdStatusRep.on('change', (newVal) => {
                if (newVal) this.lowerthirdStatus = JSON.parse(JSON.stringify(newVal)) || {};
            });
        });
	}
}).mount('#app');
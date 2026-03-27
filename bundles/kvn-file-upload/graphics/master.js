const activeSceneRep = nodecg.Replicant('active-scene', 'kvn-file-upload');

const { createApp } = Vue;

createApp({
	data() {
		return {
			activeScene: 'none',
            isKeyMode: new URLSearchParams(window.location.search).get('mode') === 'key',
		}
	},
	methods: {
		getBundleUrl(bundleName) {
			const baseUrl = `../../${bundleName}/graphics/index.html`;
			// Если Master в режиме key, добавляем параметр и во фрейм
			return this.isKeyMode ? `${baseUrl}?mode=key` : baseUrl;
		}
	},
	mounted() {
		NodeCG.waitForReplicants(activeSceneRep).then(() => {
			activeSceneRep.on('change', (newVal) => {
				this.activeScene = newVal;
			});
		});
		
	}
}).mount('#app');
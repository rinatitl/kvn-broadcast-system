const generalRep = nodecg.Replicant('general-information', 'kvn-file-upload');
const lowerthirdStatusRep = nodecg.Replicant('lowerthird-status');

let ltTimeline;

function animateIn() {
	if (ltTimeline) {
        ltTimeline.kill();
    }

	ltTimeline = gsap.timeline({ overwrite: 'all' });

	ltTimeline.fromTo(
		'.revealLogo',
		{
			autoAlpha: 0,
			scale: 0,
			rotation: -180,
			x: 0,
		},
		{
			autoAlpha: 1,
			scale: 1,
			rotation: 0,
			x: 0,
			duration: 0.9,
			delay: 0.2,
			ease: 'back',
		}
	);
	ltTimeline.fromTo(
		'.revealBackground',
		{
			clipPath: 'polygon(17% 0%, 17% 0%, 17% 200%, 17% 200%)',
			autoAlpha: 0,
		},
		{
			clipPath: 'polygon(0% 0%, 100% 0%, 100% 200%, 0% 200%)',
			autoAlpha: 1,
			duration: 1,
			ease: 'power2.inOut',
		},
		"<"
	);
	ltTimeline.fromTo(
		'.revealText',
		{
			clipPath: 'polygon(0% 0%, 0% 0%, 0% 200%, 0% 200%)',
			x: -100,
			autoAlpha: 0,
		},
		{
			clipPath: 'polygon(0% 0%, 100% 0%, 100% 200%, 0% 200%)',
			x: 0,
			autoAlpha: 1,
			duration: 1.5,
			ease: 'power2.inOut',
		},
		"<"
	);
	ltTimeline.fromTo(
		'.revealDescription',
		{
			clipPath: 'polygon(0% 0%, 0% 0%, 0% 200%, 0% 200%)',
			x: -50,
			autoAlpha: 0,
		},
		{
			clipPath: 'polygon(0% 0%, 100% 0%, 100% 200%, 0% 200%)',
			x: 0,
			autoAlpha: 1,
			delay: 0.5,
			duration: 1,
			ease: 'power2.inOut',
		},
		"<"
	);
}

const ltElements = ['.revealLogo', '.revealBackground', '.revealText', '.revealDescription'];

function animateOut() {
	gsap.killTweensOf(ltElements);
	gsap.to(
		'.revealDescription',
		{
			autoAlpha: 0,
			duration: 0.7,
			x: 70,
		}
	);
	gsap.to(
		'.revealText',
		{
			clipPath: 'polygon(10% 0%, 10% 0%, 10% 200%, 10% 200%)',
			autoAlpha: 0,
			duration: 0.7,
			x: 70,
		}
	);
	var logoTL = gsap.timeline();
	logoTL.to(
		'.revealLogo',
		{
			x: 300,
			duration: 0.7,
		}
	)
	.to(
		'.revealLogo',
		{
			scale: 0,
			autoAlpha: 0,
			rotation: -180,
			duration: 0.5,
			ease: 'power1.inOut',
		},
		">-0.2"
	);
	gsap.to(
		'.revealBackground',
		{
			clipPath: 'polygon(50% 0%, 50% 0%, 50% 200%, 50% 200%)',
			duration: 0.7,
		}
	);

}

function clearingScreen() {
	gsap.killTweensOf(ltElements);
	gsap.set(ltElements, { clearProps: "all" });
	gsap.set(
		'.revealDescription',
		{
			clipPath: 'polygon(0% 0%, 0% 0%, 0% 200%, 0% 200%)',
			x: -50,
			autoAlpha: 0,
		}
	);
	gsap.set(
		'.revealText',
		{
			clipPath: 'polygon(0% 0%, 0% 0%, 0% 200%, 0% 200%)',
			x: -100,
			autoAlpha: 0,
		}
	);
	gsap.set(
		'.revealLogo',
		{
			autoAlpha: 0,
			scale: 0,
			rotation: -180,
			x: 0,
		}
	);
	gsap.set(
		'.revealBackground',
		{
			clipPath: 'polygon(17% 0%, 17% 0%, 17% 200%, 17% 200%)',
			autoAlpha: 0,
		}
	);

}

const { createApp } = Vue;

createApp({
	data() {
		return {
			lowerthirdStatus: {
				name: '',
				description: '',
				isOnAir: false,
				autoOut: 0,
				timerVisual: 0,
                type: null,
                id: null,
			},
			autoOutTimer: null,
			localIsOnAir: false,
			isKeyMode: false,
		}
	},
	methods: {
		playIn() {
			animateIn();
		},
		playOut() {
			if (this.autoOutTimer) {
				clearInterval(this.autoOutTimer);
				this.autoOutTimer = null;
			}
			if (lowerthirdStatusRep && lowerthirdStatusRep.value) {
				lowerthirdStatusRep.value.isOnAir = false;
				lowerthirdStatusRep.value.timerVisual = 0;
			}
			animateOut();
			this.localIsOnAir = false;
		},
		clearScreen() {
			clearingScreen();
			this.localIsOnAir = false;
			if (this.autoOutTimer) {
				clearInterval(this.autoOutTimer);
				this.autoOutTimer = null;
			}
			if (lowerthirdStatusRep && lowerthirdStatusRep.value) {
				lowerthirdStatusRep.value.isOnAir = false;
				lowerthirdStatusRep.value.timerVisual = 0;
			}
		},
		startTimer(sec) {
            animateIn();
			lowerthirdStatusRep.value.timerVisual = sec;

			this.autoOutTimer = setInterval(() => {
				if (lowerthirdStatusRep.value.timerVisual > 1) {
					lowerthirdStatusRep.value.timerVisual--;
				} else {
					// Выключаем статус. 
					// ВАЖНО: это изменение прилетит обратно в mounted, 
					// попадет в блок else if (at.isOnAir === false) 
					// и ТАМ вызовет playOut().
					lowerthirdStatusRep.value.isOnAir = false;
					lowerthirdStatusRep.value.timerVisual = 0;
					clearInterval(this.autoOutTimer);
				}
			}, 1000);
        },
	},
	mounted() {
		clearingScreen();
		nodecg.listenFor('force-reset', () => {
			console.log("ПОЛУЧЕН СИГНАЛ: Мгновенное скрытие");
			this.clearScreen();
		});
		NodeCG.waitForReplicants(lowerthirdStatusRep).then(() => {
			this.clearScreen();
			lowerthirdStatusRep.on('change', (newVal) => {
				if (!newVal) return;

				this.lowerthirdStatus = JSON.parse(JSON.stringify(newVal));

				if (newVal.isOnAir === true && this.localIsOnAir === false) {
					this.localIsOnAir = true;

					if (newVal.autoOut > 0) {
						// Запускаем ТОЛЬКО таймер (он сам внутри вызовет анимацию)
						this.startTimer(newVal.autoOut);
					} else {
						// Запускаем ТОЛЬКО анимацию (ручной режим)
						this.playIn();
					}
				}

				else if (newVal.isOnAir === false && this.localIsOnAir === true) {
					this.localIsOnAir = false;
					this.playOut();

					if (this.autoOutTimer) {
						clearInterval(this.autoOutTimer);
						this.autoOutTimer = null;
					}
				}

				this.lowerthirdStatus.name = newVal.name;
	 			this.lowerthirdStatus.description = newVal.description;
			});
		});
		const params = new URLSearchParams(window.location.search);
		this.isKeyMode = params.get('mode') === 'key';
		console.log('Is Key Mode active?:', this.isKeyMode);
	}
}).mount('#app');



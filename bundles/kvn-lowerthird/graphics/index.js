const generalRep = nodecg.Replicant('general-information', 'kvn-file-upload');

function animateIn() {
	gsap.fromTo(
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
	gsap.fromTo(
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
		}
	);
	gsap.fromTo(
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
		}
	);
	gsap.fromTo(
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
		}
	);
}

function animateOut() {
	gsap.to(
		'.revealDescription',
		{
			autoAlpha: 0,
			duration: 0.7,
			x: 70,
		}
	);
	gsap.fromTo(
		'.revealText',
		{
			clipPath: 'polygon(0% 0%, 100% 0%, 100% 200%, 0% 200%)',
		},
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
	gsap.fromTo(
		'.revealBackground',
		{
			clipPath: 'polygon(0% 0%, 100% 0%, 100% 200%, 0% 200%)',
		},
		{
			clipPath: 'polygon(50% 0%, 50% 0%, 50% 200%, 50% 200%)',
			duration: 0.7,
		}
	);

}

function clearingScreen() {
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
	var logoTL = gsap.timeline();
	logoTL.set(
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
			activeTitle: {
				name: '',
				description: '',
				isOnAir: false,
				autoOut: 0,
				draftName: '',
				draftDescription: ''
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
			clearInterval(this.autoOutTimer);
			animateOut();
		},
		clearScreen() {
			clearingScreen();
			this.localIsOnAir = false;
			if (this.autoOutTimer) {
				clearInterval(this.autoOutTimer);
				this.autoOutTimer = null;
			}
		},
		startTimer(sec) {
            animateIn();
			generalRep.value.activeTitle.timerVisual = sec;

			this.autoOutTimer = setInterval(() => {
				if (generalRep.value.activeTitle.timerVisual > 1) {
					generalRep.value.activeTitle.timerVisual--;
				} else {
					// Выключаем статус. 
					// ВАЖНО: это изменение прилетит обратно в mounted, 
					// попадет в блок else if (at.isOnAir === false) 
					// и ТАМ вызовет playOut().
					generalRep.value.activeTitle.isOnAir = false;
					generalRep.value.activeTitle.timerVisual = 0;
					clearInterval(this.autoOutTimer);
				}
			}, 1000);
        },
	},
	mounted() {
		this.clearScreen();
		nodecg.listenFor('force-reset', () => {
			console.log("ПОЛУЧЕН СИГНАЛ: Мгновенное скрытие");
			this.clearScreen();
		});
		NodeCG.waitForReplicants(generalRep).then(() => {
			generalRep.on('change', (newVal) => {
				if (!newVal || !newVal.activeTitle) return;

				const at = newVal.activeTitle;

				if (at.isOnAir && !this.localIsOnAir) {
					this.localIsOnAir = true;

					if (at.autoOut > 0) {
						// Запускаем ТОЛЬКО таймер (он сам внутри вызовет анимацию)
						this.startTimer(at.autoOut);
					} else {
						// Запускаем ТОЛЬКО анимацию (ручной режим)
						this.playIn();
					}
				}

				else if (!at.isOnAir && this.localIsOnAir) {
					this.localIsOnAir = false;
					this.playOut();

					if (this.autoOutTimer) {
						clearInterval(this.autoOutTimer);
						this.autoOutTimer = null;
					}
				}

				this.activeTitle.name = at.name;
    			this.activeTitle.description = at.description;
			});
		});
		const params = new URLSearchParams(window.location.search);
		this.isKeyMode = params.get('mode') === 'key';
		console.log('Is Key Mode active?:', this.isKeyMode);
	}
}).mount('#app');



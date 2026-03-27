function lettersSlideUp() {
    const gameName = new SplitType(
        '#game-name', { 
            types: 'chars',  
            tagName: 'span'
        });
    gsap.fromTo(
        gameName.chars, {
            opacity: 1,
            yPercent: 100,
        },
        {
            opacity: 1,
            yPercent: 0,
            duration: 0.5,
            delay: 0.4,
            ease: 'back.out(1.8)',
            stagger: {amount: 0.7},
        }
    );
}

function lettersFadeOut() {
    const gameName = new SplitType(
        '#game-name', { 
            types: 'chars',  
            tagName: 'span'
        });
    gsap.fromTo(
        gameName.chars, {
            opacity: 1
        },
        {
            opacity: 0
        }
    );
}

function teamsShow(done) {
    gsap.fromTo(
        '.element', 
        {
            opacity: 0,
            yPercent: 40,
        },
        {
            opacity: 1,
            yPercent: 0,
            duration: 0.5,
            delay: 0,
            ease: 'power.in',
            stagger: {amount: 1},
        }
    );
    gsap.fromTo(
        '.legend, .header', 
        {
            opacity: 0,
        },
        {
            opacity: 1,
            onComplete: done
        }
    );
}

function teamsHide(done) {
    gsap.fromTo(
        '.element', {
            opacity: 1,
            yPercent: 0,
        },
        {
            opacity: 0,
            yPercent: 40,
            duration: 0.5,
            delay: 0,
            backgroundColor: "#F4EBCA",
            ease: 'power1.in',
            stagger: {amount: 0.1},
            onComplete: done
        }
    );
    gsap.fromTo(
        '.legend, .header', 
        {
            opacity: 1,
        },
        {
            opacity: 0,
            duration: 0.5,
        }
    );
}

function teamsSet() {
    gsap.set(
        '.element', 
        {
            opacity: 0,
            yPercent: 40
        }
    );
    gsap.set(
        '.legend, .header', 
        {
            opacity: 0
        }
    );
    gsap.set(
        '#game-name .char', 
        {
            opacity: 0
        }
    );
}

const teamsRep = nodecg.Replicant('teams', 'kvn-file-upload');
const scoreboardStatusRep = nodecg.Replicant('scoreboard-status', 'kvn-scoreboard');

const { createApp } = Vue;

createApp({
	data() {
		return {
            vueTeams: [],
            scoreboardStatus: {},
            animatedSums: {},
            highlightedTeams: [],
            ignoreAnimation: false,
		}
	},
	methods: {
        onEnter(el, done) {
            if(this.ignoreAnimation) {
                done();
                return;
            }
            this.myGlobalInAnimation(done);
        },
        onLeave(el, done) {
            if(this.ignoreAnimation) {
                done();
                return;
            }
            this.myGlobalOutAnimation(done);
        },
        myGlobalInAnimation(done) {
            lettersSlideUp();
            teamsShow(done);
        },
        myGlobalOutAnimation(done) {
            lettersFadeOut();
            teamsHide(done);
        },
        clearScreen() {
            this.ignoreAnimation = true;
            teamsSet();
            this.scoreboardStatus.isOnAir = false;
            setTimeout(() => {this.ignoreAnimation = false; }, 100);
        }
	},
    computed: {
        elementHeight() {
            let n = this.vueTeams.length;
            if (n === 0) return 'auto';

            let heightSum = 455;
            let heightRatio = 0.6;

            let effectiveN = (n % 2 === 1) ? n + 1 : n;

            if (effectiveN > 14) {
                heightSum = 475;
            } else {
                heightSum = 455;
            }

            if (effectiveN <= 6) {
                heightRatio = 0.75;
            } else {
                heightRatio = 0.6;
            }

            return (heightSum / (effectiveN * heightRatio)) + 'px';
        },
        sortedTeams() {
            if (!this.vueTeams.length) return [];
            return _.orderBy(this.vueTeams, ['sum', 'votes'], ['desc', 'desc']);
        }
    },
    watch: {
        vueTeams: {
            deep: true,
            handler(newVal) {
                // Проверка: если данных нет, ничего не делаем
                if (!newVal || !Array.isArray(newVal)) return;

                newVal.forEach((team) => {
                    // 1. Проверяем, есть ли уже анимированное значение для этой команды
                    const currentVisualSum = this.animatedSums[team.id];

                    // 2. Логика подсветки: если новый балл больше того, что мы сейчас показываем
                    if (currentVisualSum !== undefined && team.sum > currentVisualSum) {
                        gsap.to(`#team${team.id}`, {
                            backgroundColor: "#f2d5b4", 
                            duration: 0.8,
                            ease: "power2.out",
                            delay: 0.7
                        });

                        if (!this.highlightedTeams.includes(team.id)) {
                            this.highlightedTeams.push(team.id);
                        }
                    }

                    // 3. Если команда появилась впервые, записываем начальное значение
                    if (this.animatedSums[team.id] === undefined) {
                        this.animatedSums[team.id] = team.sum || 0;
                    }

                    // 4. Запускаем накрутку GSAP
                    gsap.to(this.animatedSums, {
                        duration: 1,
                        [team.id]: team.sum,
                        snap: { [team.id]: 1 },
                        ease: "power2.out"
                    });
                });
            }
        },
        'scoreboardStatus.isOnAir'(newVal) {
            if (newVal === false) {
                this.highlightedTeams = []; 
            }
        }
    },
	mounted() {
        NodeCG.waitForReplicants(teamsRep, scoreboardStatusRep).then(() => {
            teamsRep.on('change', (newVal) => {
                if (newVal) this.vueTeams = JSON.parse(JSON.stringify(newVal)) || [];
            });

            scoreboardStatusRep.on('change', (newVal) => {
                if (newVal) this.scoreboardStatus = JSON.parse(JSON.stringify(newVal)) || [];
            });
        });
        nodecg.listenFor('clear-screen-instant', () => {
            this.clearScreen();
        });
	}
}).mount('#app');


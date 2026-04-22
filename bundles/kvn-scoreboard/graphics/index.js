function lettersSlideUp() {
	const gameName = new SplitType("#game-name", {
		types: "chars",
		tagName: "span",
	});
	gsap.fromTo(
		gameName.chars,
		{
			opacity: 1,
			yPercent: 100,
		},
		{
			opacity: 1,
			yPercent: 0,
			duration: 0.5,
			delay: 0.4,
			ease: "back.out(1.8)",
			stagger: { amount: 0.7 },
		},
	);
}

function lettersFadeOut() {
	const gameName = new SplitType("#game-name", {
		types: "chars",
		tagName: "span",
	});
	gsap.fromTo(
		gameName.chars,
		{
			opacity: 1,
		},
		{
			opacity: 0,
		},
	);
}

function teamsShow(done) {
	gsap.fromTo(
		".element",
		{
			opacity: 0,
			yPercent: 40,
		},
		{
			opacity: 1,
			yPercent: 0,
			duration: 0.5,
			delay: 0,
			ease: "power.in",
			stagger: { amount: 1 },
		},
	);
	gsap.fromTo(
		".legend, .header",
		{
			opacity: 0,
		},
		{
			opacity: 1,
			onComplete: done,
		},
	);
}

function teamsHide(done) {
	gsap.fromTo(
		".element",
		{
			opacity: 1,
			yPercent: 0,
		},
		{
			opacity: 0,
			yPercent: 40,
			duration: 0.5,
			delay: 0,
			backgroundColor: "#F4EBCA",
			ease: "power1.in",
			stagger: { amount: 0.1 },
			onComplete: done,
		},
	);
	gsap.fromTo(
		".legend, .header",
		{
			opacity: 1,
		},
		{
			opacity: 0,
			duration: 0.5,
		},
	);
}

function teamsSet() {
	gsap.set(".element", {
		opacity: 0,
		yPercent: 40,
	});
	gsap.set(".legend, .header", {
		opacity: 0,
	});
	gsap.set("#game-name .char", {
		opacity: 0,
	});
}

const teamsRep = nodecg.Replicant("teams", "kvn-file-upload");
const scoreboardStatusRep = nodecg.Replicant("scoreboard-status", "kvn-scoreboard");

const { createApp } = Vue;

createApp({
	data() {
		return {
			vueTeams: [],
			displayTeams: [],
			teamAdds: {},
			scoreboardStatus: {},
			animatedSums: {},
			highlightedTeams: [],
			ignoreAnimation: false,
		};
	},
	methods: {
		onEnter(el, done) {
			if (this.ignoreAnimation) {
				done();
				return;
			}
			this.myGlobalInAnimation(done);
		},
		onLeave(el, done) {
			if (this.ignoreAnimation) {
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
			setTimeout(() => {
				this.ignoreAnimation = false;
			}, 100);
		},
		runStepByStepAnimation(teamId, oldSum, newSum) {
			gsap.globalTimeline.timeScale(0.9);
			// 1. ПРОВЕРКА НА ОБНУЛЕНИЕ
			if (newSum === 0) {
				const tl = gsap.timeline();

				tl.add(() => {
					const elements = document.querySelectorAll(".element");
					const firstPositions = new Map();
					elements.forEach((el) => firstPositions.set(el.id, el.getBoundingClientRect()));

					// Мгновенно обновляем данные для логики Vue
					const teamIndex = this.displayTeams.findIndex((t) => t.id === teamId);
					if (teamIndex !== -1) {
						this.displayTeams[teamIndex].sum = 0;
					}

					this.$nextTick(() => {
						const elementsAfter = document.querySelectorAll(".element");
						elementsAfter.forEach((el) => {
							const firstRect = firstPositions.get(el.id);
							const lastRect = el.getBoundingClientRect();

							if (firstRect) {
								const dx = firstRect.left - lastRect.left;
								const dy = firstRect.top - lastRect.top;

								if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
									gsap.fromTo(
										el,
										{ x: dx, y: dy },
										{ x: 0, y: 0, duration: 1, ease: "power2.inOut" },
									);
								}
							}
						});
					});
				});

				// Параллельно с движением плавно гасим цифры до нуля
				tl.to(
					this.animatedSums,
					{
						[teamId]: 0,
						duration: 0.8,
						snap: { [teamId]: 1 },
						ease: "power1.inOut",
					},
					"<",
				); // Символ "<" заставляет анимацию начаться одновременно с перемещением

				// Убираем подсветку в конце, если она была
				tl.add(() => {
					const teamIndex = this.highlightedTeams.indexOf(teamId);
					if (teamIndex !== -1) {
						this.highlightedTeams.splice(teamIndex, 1);
					}
				});

				return; // Выходим из функции, чтобы не выполнять основной код с волнами
			}

			const tl = gsap.timeline();

			// --- ЭТАП 1: Подготовка ---
			tl.add(() => {
				this.teamAdds[teamId] = newSum - oldSum;
				this.teamAdds = { ...this.teamAdds };
				// Подсветка включается сразу, но основной цвет поменяем позже
				if (!this.highlightedTeams.includes(teamId)) {
					this.highlightedTeams.push(teamId);
				}
			});

			// --- ЭТАП 2: Первая волна и накрутка цифр ---
			tl.add(() => {
				this.$nextTick(() => {
					const addEl = document.querySelector(`#teamAdd${teamId}`);
					const waveEl = document.querySelector(`#team${teamId} .wave-layer`);

					if (addEl) gsap.fromTo(addEl, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5 });
					if (waveEl)
						gsap.fromTo(waveEl, { left: "-100%" }, { left: "100%", duration: 1, ease: "power2.inOut" });

					gsap.to(this.animatedSums, {
						[teamId]: newSum,
						duration: 0.4,
						delay: 0.5,
						snap: { [teamId]: 1 },
						ease: "power1.out",
					});
				});
			});

			tl.to({}, { duration: 1.5 });

			const orderBefore = this.sortedDisplayTeams.map((t) => t.id);
			const nextTeams = this.displayTeams.map((t) => ({
				...t,
				sum: t.id === teamId ? newSum : this.animatedSums[t.id] || t.sum,
			}));
			const orderAfter = _.orderBy(nextTeams, ["sum", "votes"], ["desc", "desc"]).map((t) => t.id);
			const movingTeamIds = orderBefore.filter((id, index) => id !== orderAfter[index]);
			const movingRanksSelector = movingTeamIds.map((id) => `#team${id} .team-rank`).join(",");

			if (movingRanksSelector) {
				tl.to(movingRanksSelector, { opacity: 0, duration: 0.2 });
			}

			// --- ЭТАП 3: Перемещение (FLIP) ---
			tl.add(() => {
				const elements = document.querySelectorAll(".element");
				const firstPositions = new Map();
				elements.forEach((el) => firstPositions.set(el.id, el.getBoundingClientRect()));

				// ТРИГГЕР СОРТИРОВКИ
				const teamIndex = this.displayTeams.findIndex((t) => t.id === teamId);
				if (teamIndex !== -1) {
					this.displayTeams[teamIndex].sum = newSum;
				}

				this.$nextTick(() => {
					const elementsAfter = document.querySelectorAll(".element");
					elementsAfter.forEach((el) => {
						const firstRect = firstPositions.get(el.id);
						const lastRect = el.getBoundingClientRect();

						if (firstRect) {
							const dx = firstRect.left - lastRect.left;
							const dy = firstRect.top - lastRect.top;

							if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
								gsap.killTweensOf(el);
								const isActive = el.id === `team${teamId}`;
								if (isActive) el.style.zIndex = "10";

								gsap.fromTo(
									el,
									{ x: dx, y: dy },
									{
										x: 0,
										y: 0,
										duration: 1.2,
										ease: "power2.inOut",
										onComplete: () => {
											if (isActive) el.style.zIndex = "";
										},
									},
								);
							}
						}
					});
				});
			});

			// Ждем окончания перемещения
			tl.to({}, { duration: 1.5 });

			tl.add(() => {
				const allRanks = document.querySelectorAll(".team-rank");

				const hiddenRanks = Array.from(allRanks).filter((el) => {
					return window.getComputedStyle(el).opacity < 0.1;
				});

				if (hiddenRanks.length > 0) {
					gsap.to(hiddenRanks, {
						opacity: 1,
						duration: 0.5,
						stagger: 0.1,
						ease: "power1.out",
					});
				}
			});

			// --- ЭТАП 4: Финальная волна + Смена цвета + Убирание дельты ---
			tl.add(() => {
				const teamEl = document.querySelector(`#team${teamId}`);
				const waveEl = teamEl?.querySelector(".wave-layer");
				const addEl = document.querySelector(`#teamAdd${teamId}`);

				// 1. Вторая "финишная" волна
				if (waveEl) {
					gsap.fromTo(waveEl, { left: "-100%" }, { left: "100%", duration: 1, ease: "power2.inOut" });
				}

				// 2. Плавная смена цвета фона (например, на более яркий или золотистый)
				if (teamEl) {
					gsap.to(teamEl, {
						backgroundColor: "#f6d5b2", // Усиливаем подсветку
						delay: 0.5,
						duration: 0.5,
						ease: "power1.inOut",
					});
				}

				// 3. Плавно убираем дельту
				if (addEl) {
					gsap.to(addEl, {
						opacity: 0,
						y: -20,
						duration: 0.6,
						delay: 0.4, // Начинает исчезать чуть позже старта волны
						onComplete: () => {
							delete this.teamAdds[teamId];
							this.teamAdds = { ...this.teamAdds };
						},
					});
				}
			});
		},
		executeResetAnimation() {
			console.log("inside executeResetAnimation");
			this.highlightedTeams = [];

			const elements = document.querySelectorAll(".element");
			gsap.to(elements, {
				backgroundColor: "#F4EBCA", // Или твой исходный цвет плашки
				duration: 0.8,
				stagger: 0.05,
				ease: "power2.inOut",
				onComplete: () => {
					// ОЧЕНЬ ВАЖНО: Удаляем инлайновый стиль после анимации.
					// Это позволит CSS снова управлять элементом, если нужно.
					gsap.set(elements, { clearProps: "backgroundColor" });
				},
			});

			const activeAdds = document.querySelectorAll('[id^="teamAdd"]');
			if (activeAdds.length > 0) {
				gsap.to(activeAdds, { opacity: 0, y: -20, duration: 0.5 });
			}
		},
	},
	computed: {
		elementHeight() {
			let n = this.vueTeams.length;
			if (n === 0) return "auto";

			let heightSum = 455;
			let heightRatio = 0.6;

			let effectiveN = n % 2 === 1 ? n + 1 : n;

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

			return heightSum / (effectiveN * heightRatio) + "px";
		},
		sortedDisplayTeams() {
			if (!this.displayTeams.length) return [];

			const draft = this.displayTeams.map((team) => {
				const currentSum = Number(team.sum) || 0;
				const currentVotes = Number(team.votes) || 0;

				return {
					...team,
					sum: currentSum,
					votes: currentVotes,
				};
			});

			return _.orderBy(draft, ["sum", "votes"], ["desc", "desc"]);
		},
	},
	watch: {
		vueTeams: {
			deep: true,
			handler(newVal) {
				// Проверка: если данных нет, ничего не делаем
				if (!newVal || !Array.isArray(newVal)) return;

				if (this.displayTeams.length === 0) {
					this.displayTeams = JSON.parse(JSON.stringify(newVal));
					newVal.forEach((t) => {
						this.animatedSums[t.id] = Number(t.sum) || 0;
					});
					return;
				}

				if (newVal.length !== this.displayTeams.length) {
					this.displayTeams = JSON.parse(JSON.stringify(newVal));
				} else {
					newVal.forEach((team) => {
						const displayT = this.displayTeams.find((t) => t.id === team.id);
						if (displayT) {
							displayT.name = team.name; // Обновляем имя мгновенно
						}
					});
				}

				newVal.forEach((team) => {
					// 1. Проверяем, есть ли уже анимированное значение для этой команды
					const currentVisualSum = this.animatedSums[team.id];
					const newBackendSum = Number(team.sum) || 0;

					// 2. Логика подсветки: если новый балл больше того, что мы сейчас показываем
					if (currentVisualSum !== undefined && newBackendSum != currentVisualSum) {
						console.log(`Команда ${team.name} получила баллы: ${newBackendSum}`);
						// Эту функцию напишем на следующем шаге
						this.runStepByStepAnimation(team.id, currentVisualSum, newBackendSum);
					}
				});
			},
		},
		"scoreboardStatus.isOnAir"(newVal) {
			if (newVal === true) {
				this.displayTeams = JSON.parse(JSON.stringify(this.vueTeams));
				this.vueTeams.forEach((t) => {
					this.animatedSums[t.id] = Number(t.sum) || 0;
				});
			} else {
				this.teamAdds = {};
				this.highlightedTeams = [];
			}
		},
	},
	mounted() {
		NodeCG.waitForReplicants(teamsRep, scoreboardStatusRep).then(() => {
			teamsRep.on("change", (newVal) => {
				if (newVal) this.vueTeams = JSON.parse(JSON.stringify(newVal)) || [];
			});

			scoreboardStatusRep.on("change", (newVal) => {
				if (newVal) this.scoreboardStatus = JSON.parse(JSON.stringify(newVal)) || [];
			});
		});
		nodecg.listenFor("clear-screen-instant", () => {
			this.clearScreen();
		});
		nodecg.listenFor("trigger-reset-highlights", () => {
			console.log("listened");
			this.executeResetAnimation();
		});
	},
}).mount("#app");

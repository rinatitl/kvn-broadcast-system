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
			animationTargets: {},
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
			this.cancelScoreAnimations();
			this.ignoreAnimation = true;
			teamsSet();
			this.scoreboardStatus.isOnAir = false;
			setTimeout(() => {
				this.ignoreAnimation = false;
			}, 100);
		},
		cancelScoreAnimations() {
			for (const run of this.scoreRuns?.values() || []) {
				run.cancelled = true;
				run.cancel?.();
			}
			gsap.set(".element", { clearProps: "transform,zIndex" });
			gsap.set(".wave-layer", { left: "-100%" });
		},
		async resetZeroScores(teams) {
			const resetIds = teams.filter(team => Number(team.sum) === 0 && this.animatedSums[team.id] !== 0).map(team => team.id);
			if (!resetIds.length) return;
			this.cancelScoreAnimations();
			const elements = [...document.querySelectorAll(".element")];
			const positions = new Map(elements.map(el => [el.id, el.getBoundingClientRect()]));
			for (const id of resetIds) {
				const team = this.displayTeams.find(t => t.id === id);
				if (team) team.sum = 0;
				this.animatedSums[id] = 0;
				delete this.teamAdds[id];
				const el = document.getElementById(`team${id}`);
				if (el) gsap.set(el, { clearProps: "backgroundColor" });
			}
			this.highlightedTeams = this.highlightedTeams.filter(id => !resetIds.includes(id));
			await this.$nextTick();
			if (!this.scoreboardStatus.isOnAir) return;
			for (const el of elements) {
				const before = positions.get(el.id);
				const after = el.getBoundingClientRect();
				const x = before.left - after.left, y = before.top - after.top;
				if (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) {
					gsap.fromTo(el, { x, y }, { x: 0, y: 0, duration: 1, ease: "power2.inOut" });
				}
			}
		},
		async runStepByStepAnimation(teamId, oldSum, newSum, command) {
			if (newSum === 0) {
				await this.resetZeroScores([{ id: teamId, sum: 0 }]);
				if (command?.id) nodecg.sendMessage("score-animation-finished", command.id);
				return;
			}
			const run = { cancelled: false };
			this.scoreRuns.set(teamId, run);
			this.animationTargets[teamId] = newSum;
			const suspense = command?.mode === "suspense";
			const teamEl = document.getElementById(`team${teamId}`);
			const sumEl = teamEl?.querySelector(".main-sum");
			const waveEl = teamEl?.querySelector(".wave-layer");
			let ranks = [];
			const play = build => new Promise((resolve, reject) => {
				const tl = gsap.timeline({ paused: true, onComplete: resolve });
				tl.timeScale(0.9);
				run.cancel = () => { tl.kill(); reject(new Error("cancelled")); };
				build(tl);
				if (run.cancelled) run.cancel();
				else tl.play();
			});
			try {
				if (!teamEl || !this.scoreboardStatus.isOnAir) {
					const team = this.displayTeams.find(t => t.id === teamId);
					if (team) team.sum = newSum;
					this.animatedSums[teamId] = newSum;
					return;
				}
				const orderBefore = this.sortedDisplayTeams.map(t => t.id);
				const nextTeams = this.displayTeams.map(t => ({ ...t, sum: t.id === teamId ? newSum : Number(t.sum) || 0, votes: Number(t.votes) || 0 }));
				const orderAfter = _.orderBy(nextTeams, ["sum", "votes"], ["desc", "desc"]).map(t => t.id);
				const movingIds = orderBefore.filter((id, index) => id !== orderAfter[index]);
				const suspenseRankIds = orderBefore.slice(0, orderBefore.indexOf(teamId) + 1);
				ranks = (suspense ? suspenseRankIds : movingIds)
					.map(id => document.getElementById(`team${id}`)?.querySelector(".team-rank")).filter(Boolean);
				this.teamAdds[teamId] = newSum - oldSum;
				await this.$nextTick();
				if (run.cancelled) return;
				const addEl = document.getElementById(`teamAdd${teamId}`);
				await play(tl => {
					if (addEl) tl.fromTo(addEl, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5 }, 0);
					if (suspense) {
						if (sumEl) tl.to(sumEl, { opacity: 0, duration: 0.3 }, 1.05);
						if (waveEl) tl.fromTo(waveEl, { left: "-100%" }, { left: "100%", duration: 1.4, ease: "power2.inOut" }, 0.35);
						if (ranks.length) tl.to(ranks, { opacity: 0, duration: 0.2 }, 1.9);
					} else {
						if (waveEl && newSum !== 0) tl.fromTo(waveEl, { left: "-100%" }, { left: "100%", duration: 1, ease: "power2.inOut" }, 0);
						tl.to(this.animatedSums, { [teamId]: newSum, duration: 0.4, snap: { [teamId]: 1 }, ease: "power1.out" }, 0.5);
						if (ranks.length) tl.to(ranks, { opacity: 0, duration: 0.2 }, 1.5);
					}
				});
				const elements = [...document.querySelectorAll(".element")];
				const positions = new Map(elements.map(el => [el.id, el.getBoundingClientRect()]));
				const team = this.displayTeams.find(t => t.id === teamId);
				if (team) team.sum = newSum;
				await this.$nextTick();
				if (run.cancelled) return;
				teamEl.style.zIndex = "10";
				await play(tl => {
					const duration = suspense ? 2.2 : 1.2;
					// Keep a reveal pause even when the team's position does not change.
					tl.to({}, { duration }, 0);
					for (const el of elements) {
						const before = positions.get(el.id);
						const after = el.getBoundingClientRect();
						const x = before.left - after.left, y = before.top - after.top;
						if (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) tl.fromTo(el, { x, y }, { x: 0, y: 0, duration, ease: "power2.inOut" }, 0);
					}
				});
				await this.$nextTick();
				if (run.cancelled) return;
				// Reveal ranks in their new table order, including the moved team.
				ranks = this.sortedDisplayTeams
					.map(team => document.getElementById(`team${team.id}`)?.querySelector(".team-rank"))
					.filter(rank => ranks.includes(rank));
				const rankDuration = 0.5, rankStagger = 0.1;
				const waveLead = suspense ? 0.35 : 0;
				const teamRankIndex = ranks.indexOf(teamEl.querySelector(".team-rank"));
				const finalWaveStart = suspense ? Math.max(0, teamRankIndex) * rankStagger : 0.2;
				await play(tl => {
					if (ranks.length) tl.to(ranks, { opacity: 1, duration: rankDuration, stagger: rankStagger, ease: "power1.out" }, waveLead);
					if (suspense && sumEl) tl.to(sumEl, { opacity: 1, duration: 0.5 }, 0);
					if (suspense) tl.to(this.animatedSums, {
						[teamId]: newSum, duration: 0.6, snap: { [teamId]: 1 }, ease: "power1.out",
					}, finalWaveStart + 0.65); // Count halfway through the final suspense wave.
					// Let the original gradient ease in from outside before the rank fades in.
					if (waveEl) tl.fromTo(waveEl, { left: "-100%" }, { left: "100%", duration: suspense ? 1.3 : 1, ease: "power2.inOut", immediateRender: false }, finalWaveStart);
					tl.to(teamEl, { backgroundColor: newSum === 0 ? "#F4EBCA" : "#f6d5b2", duration: 0.5 }, suspense ? finalWaveStart + 0.2 : 0.7);
					if (addEl) tl.to(addEl, { opacity: 0, y: -20, duration: 0.6 }, suspense ? finalWaveStart + 0.4 : 0.6);
				});
				if (newSum !== 0 && !this.highlightedTeams.includes(teamId)) this.highlightedTeams.push(teamId);
				if (newSum === 0) this.highlightedTeams = this.highlightedTeams.filter(id => id !== teamId);
			} catch (error) {
				if (!run.cancelled) console.error("Score animation failed", error);
			} finally {
				delete this.teamAdds[teamId];
				delete this.animationTargets[teamId];
				this.scoreRuns.delete(teamId);
				if (teamEl) {
					teamEl.style.zIndex = "";
					gsap.set(teamEl, { clearProps: "transform" });
				}
				gsap.set([...ranks, sumEl].filter(Boolean), { opacity: 1 });
				if (command?.id) nodecg.sendMessage("score-animation-finished", command.id);
			}
		},
		executeResetAnimation() {
			console.log("inside executeResetAnimation");
			this.highlightedTeams = [];

			const elements = document.querySelectorAll(".element:not(.is-inactive)");
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
		processElimination(idsToDrop) {
			if (!idsToDrop || idsToDrop.length === 0) return;

			const selectors = idsToDrop.map((id) => `#team${id}`).join(",");

			gsap.to(selectors, {
				backgroundColor: "#d3cdb7",
				duration: 1.2,
				stagger: {
					each: 0.2,
					from: "end",
				},
				ease: "power2.inOut",
				onComplete: () => {
					idsToDrop.forEach((id) => {
						const displayT = this.displayTeams.find((team) => team.id === id);
						if (displayT) {
							displayT.isInactive = true;
						}
					});

					this.$nextTick(() => {
						gsap.set(selectors, { clearProps: "backgroundColor" });
					});
				},
			});
		},
		processCancelElimination() {
			const allTeams = document.querySelectorAll(".element");

			gsap.to(allTeams, {
				backgroundColor: "#f4ebca",
				duration: 1,
				stagger: 0.2,
				ease: "power2.out",
				onComplete: () => {
					this.displayTeams.forEach((team) => {
						team.isInactive = false;
					});

					this.$nextTick(() => {
						gsap.set(allTeams, { clearProps: "backgroundColor" });
					});
				},
			});
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
					newVal.forEach((t) => {
						this.animatedSums[t.id] = Number(t.sum) || 0;
					});
				} else {
					newVal.forEach((team) => {
						const displayT = this.displayTeams.find((t) => t.id === team.id);
						if (displayT) {
							displayT.name = team.name; // Обновляем имя мгновенно
							displayT.votes = team.votes;
						}
					});
				}

				// Apply all zeroed scores together so a bulk reset has one rearrangement.
				this.resetZeroScores(newVal);
				newVal.forEach((team) => {
					// 1. Проверяем, есть ли уже анимированное значение для этой команды
					const currentVisualSum = this.animatedSums[team.id];
					const newBackendSum = Number(team.sum) || 0;

					// Do not restart a running animation when unrelated team fields change.
					if (currentVisualSum !== undefined && newBackendSum != currentVisualSum && this.animationTargets[team.id] !== newBackendSum) {
						console.log(`Команда ${team.name} получила баллы: ${newBackendSum}`);
						this.runStepByStepAnimation(team.id, currentVisualSum, newBackendSum,
							team.scoreAnimation?.newSum === newBackendSum ? team.scoreAnimation : undefined);
					}
				});
			},
		},
		"scoreboardStatus.isOnAir"(newVal) {
			this.cancelScoreAnimations();
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
		this.scoreRuns = new Map();
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
		nodecg.listenFor("trigger-elimination-animation", (idsToDrop) => {
			this.processElimination(idsToDrop);
		});
		nodecg.listenFor("cancel-elimination-animation", () => {
			this.processCancelElimination();
		});
	},
}).mount("#app");

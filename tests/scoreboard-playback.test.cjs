const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const _ = require("../bundles/kvn-file-upload/shared/vendor/lodash/lodash.min.js");
const root = path.resolve(__dirname, "../bundles/kvn-scoreboard");

function loadApp(file, extras = {}) {
	let options;
	const nodecg = { Replicant: () => ({}), ...extras.nodecg };
	vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), {
		Vue: { createApp: value => { options = value; return { mount() {} }; } },
		nodecg, _, console, document: { querySelectorAll: () => [] }, ...extras,
	});
	const app = { ...options.data(), ...options.methods, $nextTick: async () => {} };
	for (const [name, getter] of Object.entries(options.computed)) {
		Object.defineProperty(app, name, { get: () => getter.call(app) });
	}
	return app;
}

test("next selects the lowest pending active team by score and votes, independently of dashboard sorting", () => {
	const app = loadApp("dashboard/kvn-scoreboard.js");
	app.vueTeams = [
		{ id: "leader", sum: 30, votes: 0 },
		{ id: "a", sum: 10, votes: 2 },
		{ id: "b", sum: 10, votes: 1 },
		{ id: "inactive", sum: 0, isInactive: true },
	];
	app.addingPoints = { leader: "5", a: "5", b: "5", inactive: "5" };
	assert.equal(app.nextTeam.id, "b");
	app.adminSort = true;
	assert.equal(app.nextTeam.id, "b");
	app.addingPoints.b = "";
	assert.equal(app.nextTeam.id, "a");
	app.vueTeams[1].sum = 40;
	assert.equal(app.nextTeam.id, "leader");
	app.addingPoints = { a: "0", b: "", leader: "invalid" };
	assert.equal(app.nextTeam, undefined);
});

test("extension commits animation metadata with scores and rejects repeat clicks until matching completion", () => {
	const reps = new Map(), listeners = new Map();
	let timer;
	const nodecg = {
		Replicant(name, config) {
			if (!reps.has(name)) reps.set(name, { value: config?.defaultValue, on() {} });
			return reps.get(name);
		},
		listenFor: (name, callback) => listeners.set(name, callback),
	};
	const module = { exports: {} };
	vm.runInNewContext(fs.readFileSync(path.join(root, "extension.js"), "utf8"), {
		module, setTimeout: callback => { timer = callback; return 1; }, clearTimeout() {},
	});
	module.exports(nodecg);
	reps.get("teams").value = [{ id: "a", sum: 10 }, { id: "b", sum: 5, isInactive: true }];
	const apply = request => {
		let error;
		listeners.get("apply-score")(request, value => { error = value; });
		return error;
	};
	assert.equal(apply({ teamId: "a", points: 3, mode: "suspense" }), null);
	const team = reps.get("teams").value[0];
	assert.equal(team.sum, 13);
	assert.equal(team.scoreAnimation.mode, "suspense");
	assert.equal(team.scoreAnimation.oldSum, 10);
	assert.equal(team.scoreAnimation.newSum, 13);
	assert.ok(apply({ teamId: "a", points: 3 }));
	listeners.get("score-animation-finished")("stale");
	assert.equal(reps.get("score-playback").value.busy, true);
	listeners.get("score-animation-finished")(team.scoreAnimation.id);
	assert.equal(reps.get("score-playback").value.busy, false);
	assert.ok(apply({ teamId: "b", points: 3 }));
	assert.equal(apply({ teamId: "a", points: 2 }), null);
	timer();
	assert.equal(reps.get("score-playback").value.busy, false);
});

test("dashboard preserves pending points on rejection and blocks a second click while awaiting acknowledgement", async () => {
	let resolve, reject, calls = 0;
	const app = loadApp("dashboard/kvn-scoreboard.js", {
		nodecg: { Replicant: () => ({}), sendMessage: () => {
			calls++;
			return new Promise((yes, no) => { resolve = yes; reject = no; });
		} },
		console: { error() {} },
	});
	app.addingPoints = { a: "5" };
	const failed = app.applyPoints("a", "suspense");
	await app.applyPoints("a");
	assert.equal(calls, 1);
	reject(new Error("busy"));
	await failed;
	assert.equal(app.addingPoints.a, "5");
	assert.equal(app.sendingPoints, false);
	const success = app.applyPoints("a");
	resolve();
	await success;
	assert.equal(app.addingPoints.a, "");
});

for (const mode of ["normal", "suspense"]) {
for (const moves of [true, false]) {
	test(`${mode} score reveal and rank visibility (moves=${moves})`, async () => {
		let app;
		const events = [], finished = [];
		const make = id => ({ id, style: {}, getBoundingClientRect() {
			return { left: 0, top: app.sortedDisplayTeams.findIndex(t => `team${t.id}` === id) * 70 };
		} });
		const ranks = [make("rank-a"), make("rank-b"), make("rank-c")];
		const sum = make("sum"), wave = make("wave"), add = make("add");
		const rows = [make("teama"), make("teamb"), make("teamc")];
		rows.forEach((row, i) => { row.querySelector = selector => ({ ".team-rank": ranks[i], ".main-sum": sum, ".wave-layer": wave })[selector]; });
		const gsap = {
			set() {},
			timeline({ onComplete }) {
				const steps = [];
				return {
					timeScale() {}, kill() {},
					to(target, vars, at) { steps.push({ target, vars, at }); return this; },
					fromTo(target, from, vars, at) { steps.push({ target, from, vars, at }); return this; },
					play() {
						for (const step of steps) {
							events.push({ ...step, score: app.animatedSums.b, delta: app.teamAdds.b });
							if (step.target === app.animatedSums) app.animatedSums.b = step.vars.b;
						}
						queueMicrotask(onComplete);
					},
				};
			},
		};
		app = loadApp("graphics/index.js", {
			gsap,
			document: {
				querySelectorAll: () => rows,
				getElementById: id => rows.find(row => row.id === id) || add,
			},
			nodecg: { Replicant: () => ({}), sendMessage: (...args) => finished.push(args) },
		});
		app.scoreRuns = new Map();
		app.scoreboardStatus = { isOnAir: true };
		app.displayTeams = [{ id: "a", sum: 10 }, { id: "b", sum: 5 }, { id: "c", sum: 2 }];
		app.animatedSums = { a: 10, b: 5, c: 2 };
		const newSum = moves ? 15 : 7;
		const movementDuration = mode === "suspense" ? 2.2 : 1.2;
		await app.runStepByStepAnimation("b", 5, newSum, { id: "job", mode });
		const delta = events.find(e => e.target === add && e.vars.opacity === 1);
		assert.equal(delta.delta, newSum - 5);
		assert.ok(events.some(e => e.target === add && e.vars.opacity === 0));
		const rankReveal = events.find(e => Array.isArray(e.target) && e.vars.opacity === 1);
		if (rankReveal) {
			assert.equal(rankReveal.vars.stagger, 0.1);
			assert.deepEqual(Array.from(rankReveal.target), moves ? [ranks[1], ranks[0]] : ranks.slice(0, 2));
			const movement = events.findIndex(e => e.vars.duration === movementDuration);
			assert.ok(events.indexOf(rankReveal) > movement);
		}
		if (mode === "suspense") {
			const hide = events.find(e => e.vars.opacity === 0 && Array.isArray(e.target));
			assert.ok(ranks.slice(0, 2).every(rank => hide.target.includes(rank)));
			assert.equal(hide.target.includes(ranks[2]), false);
			assert.equal(rankReveal.target.includes(ranks[2]), false);
			assert.ok(events.some(e => e.target === sum && e.vars.opacity === 0));
			assert.equal(hide.score, 5);
			const movement = events.findIndex(e => e.vars.duration === movementDuration);
			const reveal = events.findIndex(e => e.target === sum && e.vars.opacity === 1);
			assert.ok(reveal > movement);
			assert.equal(events[movement].score, 5);
			assert.equal(events[reveal].score, 5);
			const count = events.findIndex(e => e.target === app.animatedSums);
			assert.ok(count > reveal);
			assert.equal(events[count].score, 5);
			assert.equal(events[count].vars.b, newSum);
			assert.equal(events[count].vars.snap.b, 1);
			assert.ok(events[count].vars.duration > 0);
			assert.ok(events[count].at >= events[reveal].at + events[reveal].vars.duration);
			const firstWave = events.find(e => e.target === wave);
			assert.ok(firstWave.at < delta.at + delta.vars.duration);
			const hideSum = events.find(e => e.target === sum && e.vars.opacity === 0);
			assert.ok(Math.abs(hideSum.at - (firstWave.at + firstWave.vars.duration / 2)) < 0.001);
			assert.ok(hide.at >= firstWave.at + firstWave.vars.duration);
			const lastWave = events.filter(e => e.target === wave).at(-1);
			assert.ok(Math.abs(lastWave.at - (rankReveal.at + rankReveal.target.indexOf(ranks[1]) * rankReveal.vars.stagger - 0.35)) < 1e-10);
			assert.equal(lastWave.from.left, "-100%");
			assert.equal(lastWave.vars.ease, "power2.inOut");
			assert.ok(Math.abs(events[count].at - (lastWave.at + lastWave.vars.duration / 2)) < 0.001);
		} else {
			const movement = events.find(e => e.vars.duration === 1.2);
			assert.equal(movement.score, newSum);
			assert.equal(events.some(e => e.target === sum && e.vars.opacity === 0), false);
			const hide = events.find(e => e.vars.opacity === 0 && Array.isArray(e.target));
			assert.equal(!!hide, moves);
		}
		assert.equal(app.animatedSums.b, newSum);
		assert.equal(app.teamAdds.b, undefined);
		assert.deepEqual(finished, [["score-animation-finished", "job"]]);
	});
}
}

test("bulk zero reset moves rows together and clears highlights without score effects", async () => {
	let app;
	const effects = [];
	const rows = ["a", "b", "c"].map(id => ({
		id: `team${id}`,
		getBoundingClientRect() {
			return { left: 0, top: app.sortedDisplayTeams.findIndex(t => t.id === id) * 70 };
		},
	}));
	app = loadApp("graphics/index.js", {
		document: { querySelectorAll: () => rows, getElementById: id => rows.find(row => row.id === id) },
		gsap: {
			set: (target, vars) => effects.push({ kind: "set", target, vars }),
			fromTo: (target, from, vars) => effects.push({ kind: "move", target, from, vars }),
			timeline() { assert.fail("Reset must not run the scoring timeline"); },
		},
	});
	app.scoreRuns = new Map();
	app.scoreboardStatus = { isOnAir: true };
	app.displayTeams = [{ id: "a", sum: 30 }, { id: "b", sum: 20 }, { id: "c", sum: 10 }];
	app.animatedSums = { a: 30, b: 20, c: 10 };
	app.teamAdds = { a: 5, b: 5 };
	app.highlightedTeams = ["a", "b", "c"];
	await app.resetZeroScores([{ id: "a", sum: 0 }, { id: "b", sum: 0 }, { id: "c", sum: 10 }]);
	assert.deepEqual(app.sortedDisplayTeams.map(t => t.id), ["c", "a", "b"]);
	assert.equal(app.animatedSums.a, 0);
	assert.equal(app.animatedSums.b, 0);
	assert.deepEqual(Array.from(app.highlightedTeams), ["c"]);
	assert.equal(Object.keys(app.teamAdds).length, 0);
	assert.equal(effects.filter(e => e.kind === "move").length, 3);
	assert.ok(effects.filter(e => e.kind === "move").every(e => Object.keys(e.vars).sort().join() === "duration,ease,x,y"));
	assert.ok(effects.some(e => e.target === rows[0] && e.vars.clearProps === "backgroundColor"));
});

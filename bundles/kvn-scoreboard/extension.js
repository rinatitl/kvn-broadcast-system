module.exports = function (nodecg) {
	const scoreboardStatusRep = nodecg.Replicant("scoreboard-status", {
		defaultValue: {
			isOnAir: false,
			gameTitle: "",
		},
		persistent: true,
	});

	const generalRep = nodecg.Replicant("general-information", "kvn-file-upload");

	generalRep.on("change", (newVal) => {
		scoreboardStatusRep.value.gameTitle = newVal?.gameTitle || "";
	});
	const teamsRep = nodecg.Replicant("teams", "kvn-file-upload");
	const playbackRep = nodecg.Replicant("score-playback", {
		defaultValue: { busy: false }, persistent: false,
	});
	let releaseTimer;
	const release = () => {
		clearTimeout(releaseTimer);
		playbackRep.value = { busy: false };
	};
	nodecg.listenFor("apply-score", (request, ack) => {
		const team = teamsRep.value?.find(t => t.id === request?.teamId);
		const points = Number(request?.points);
		if (playbackRep.value.busy || !team || team.isInactive || !Number.isInteger(points) || !points) {
			if (ack && !ack.handled) ack(new Error("Начисление сейчас недоступно"));
			return;
		}
		const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const oldSum = Number(team.sum) || 0;
		playbackRep.value = { busy: true, id };
		teamsRep.value = teamsRep.value.map(t => t.id === team.id ? {
			...t, sum: oldSum + points,
			scoreAnimation: { id, oldSum, newSum: oldSum + points, mode: request.mode === "suspense" ? "suspense" : "normal" },
		} : t);
		// Recover if the graphics page is closed or disconnected.
		releaseTimer = setTimeout(release, 20000);
		if (ack && !ack.handled) ack(null);
	});
	nodecg.listenFor("score-animation-finished", id => {
		if (playbackRep.value.id === id) release();
	});
	nodecg.listenFor("clear-screen-instant", release);
};

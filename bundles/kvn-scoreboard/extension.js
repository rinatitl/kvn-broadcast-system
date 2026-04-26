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
};

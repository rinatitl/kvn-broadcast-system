module.exports = function (nodecg) {
	nodecg.Replicant("teams", {
		defaultValue: [],
		persistent: true,
	});

	nodecg.Replicant("juries", {
		defaultValue: [],
		persistent: true,
	});

	nodecg.Replicant("contests", {
		defaultValue: [],
		persistent: true,
	});

	nodecg.Replicant("general-information", {
		defaultValue: {
			gameTitle: "",
			date: "",
			host: "",
			currentContest: 0,
		},
		persistent: true,
	});

	nodecg.Replicant("active-scene", {
		defaultValue: "none",
		persistent: true,
	});

	// Resolve IDs against the latest data so a reorder cannot overwrite score updates.
	nodecg.listenFor("reorder-list", (request, ack) => {
		if (!["teams", "juries"].includes(request?.list)) {
			if (ack && !ack.handled) ack(new Error("Неизвестный список"));
			return;
		}
		const rep = nodecg.Replicant(request.list);
		const items = [...(rep.value || [])];
		const from = items.findIndex(item => item.id === request.sourceId);
		const target = items.findIndex(item => item.id === request.targetId);
		if (from < 0 || target < 0 || typeof request.after !== "boolean") {
			if (ack && !ack.handled) ack(new Error("Список изменился. Повторите перетаскивание"));
			return;
		}
		if (from !== target) {
			const [item] = items.splice(from, 1);
			const destination = items.findIndex(item => item.id === request.targetId);
			items.splice(destination + (request.after ? 1 : 0), 0, item);
			rep.value = items;
		}
		if (ack && !ack.handled) ack(null);
	});

	nodecg.log.info("База данных команд готова!");
};

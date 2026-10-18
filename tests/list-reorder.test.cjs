const test = require("node:test");
const assert = require("node:assert/strict");
const register = require("../bundles/kvn-file-upload/extension.js");

function setup() {
	const reps = new Map(), handlers = new Map();
	register({
		Replicant(name, options) {
			if (!reps.has(name)) reps.set(name, { value: options?.defaultValue });
			return reps.get(name);
		},
		listenFor: (name, fn) => handlers.set(name, fn),
		log: { info() {} },
	});
	return { reps, reorder(request) {
		let result;
		handlers.get("reorder-list")(request, error => { result = error; });
		return result;
	} };
}

for (const list of ["teams", "juries"]) {
	test(`${list}: moves entire records in both directions and preserves latest data`, () => {
		const { reps, reorder } = setup();
		const items = [1, 2, 3].map(id => ({ id, name: `Name ${id}`, description: "Text", sum: 10 }));
		reps.get(list).value = items;
		items[0].sum = 42;
		assert.equal(reorder({ list, sourceId: 1, targetId: 3, after: true }), null);
		assert.deepEqual(reps.get(list).value.map(item => item.id), [2, 3, 1]);
		assert.equal(reps.get(list).value[2], items[0]);
		assert.equal(reps.get(list).value[2].sum, 42);
		assert.equal(reorder({ list, sourceId: 1, targetId: 2, after: false }), null);
		assert.deepEqual(reps.get(list).value, items);
	});
}

test("rejects stale IDs, malformed requests and unrelated lists without changing data", () => {
	const { reps, reorder } = setup();
	const items = [{ id: 1 }, { id: 2 }];
	reps.get("teams").value = items;
	for (const request of [null, { list: "contests" },
		{ list: "teams", sourceId: 9, targetId: 2, after: false },
		{ list: "teams", sourceId: 1, targetId: 9, after: true },
		{ list: "teams", sourceId: 1, targetId: 2 }]) {
		assert.ok(reorder(request) instanceof Error);
		assert.equal(reps.get("teams").value, items);
	}
});

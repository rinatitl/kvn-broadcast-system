const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../scripts/start.cjs'), 'utf8');

function runtime(args = []) {
	const state = { alive: true, exits: [], loaded: false, check: null, unref: false };
	vm.runInNewContext(source, {
		process: {
			pid: 200,
			argv: ['node', 'start.cjs', ...args],
			kill(pid, signal) {
				assert.equal(pid, 100);
				assert.equal(signal, 0);
				if (!state.alive) throw Object.assign(new Error('No parent'), { code: 'ESRCH' });
			},
			exit(code) { state.exits.push(code); },
		},
		setInterval(check, interval) {
			assert.equal(interval, 1000);
			state.check = check;
			return { unref() { state.unref = true; } };
		},
		require(name) { assert.equal(name, 'nodecg'); state.loaded = true; },
	});
	return state;
}

test('manual server startup has no launcher dependency', () => {
	const state = runtime();
	assert.equal(state.loaded, true);
	assert.equal(state.check, null);
});

test('launcher server exits when its parent disappears', () => {
	const state = runtime(['--launcher-parent=100']);
	state.check();
	assert.deepEqual(state.exits, []);
	assert.equal(state.unref, true);
	state.alive = false;
	state.check();
	assert.deepEqual(state.exits, [0]);
});

test('invalid launcher PID is rejected', () => {
	for (const value of ['0', '-1', 'abc', '200', '1.5']) {
		assert.throws(() => runtime([`--launcher-parent=${value}`]), /Invalid launcher parent PID/);
	}
});

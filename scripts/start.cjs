// Start the installed runtime directly; the management CLI also requires Git.
// The launcher owns this server. Also exit if the launcher is terminated without
// running its FormClosing handler (for example, by closing its console).
const parentArgument = process.argv.find((argument) => argument.startsWith('--launcher-parent='));
if (parentArgument) {
	const parentPid = Number(parentArgument.slice('--launcher-parent='.length));
	if (!Number.isSafeInteger(parentPid) || parentPid <= 0 || parentPid === process.pid) {
		throw new Error('Invalid launcher parent PID');
	}
	const checkParent = () => {
		try {
			process.kill(parentPid, 0);
		} catch (error) {
			if (error.code === 'ESRCH') process.exit(0);
		}
	};
	checkParent();
	setInterval(checkParent, 1000).unref();
}
require('nodecg');

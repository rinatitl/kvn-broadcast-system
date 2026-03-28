module.exports = function (nodecg) {
    nodecg.Replicant('lowerthird-status', {
        defaultValue: {
                name: '',
                description: '',
                isOnAir: false,
                autoOut: 0,
                timerVisual: 0,
                type: null,
                id: null,
        },
        persistent: true
    });
};
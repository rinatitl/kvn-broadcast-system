module.exports = function (nodecg) {
    nodecg.Replicant('teams', { 
        defaultValue: [], 
        persistent: true 
    });

    nodecg.Replicant('juries', { 
        defaultValue: [], 
        persistent: true 
    });

    nodecg.Replicant('contests', { 
        defaultValue: [], 
        persistent: true 
    });

    nodecg.Replicant('general-information', { 
        defaultValue: { 
            gameTitle: "",
			date: "",
			host: "",
			currentContest: 0, 
            activeTitle: {
                name: '',
                description: '',
                isOnAir: false,
                autoOut: 0,
                timerVisual: 0
            }
        }, 
        persistent: true 
    });

    nodecg.Replicant('active-scene', {
        defaultValue: 'none',
        persistent: true
    })

    nodecg.log.info('База данных команд готова!');   
};
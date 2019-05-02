const {todayName} = require('./components/utils');
const {Time} = require('./services/time.service');

module.exports = {
    todayName,
    getDay: Time.serverTimeGetDay
};
